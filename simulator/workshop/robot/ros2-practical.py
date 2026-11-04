"""Local ROS 2 practical for an isolated synthetic cell."""
import argparse
import hashlib
import json
from importlib.metadata import PackageNotFoundError, version
import math
import os
from pathlib import Path
import time


def parser():
    result = argparse.ArgumentParser(description=__doc__)
    sub = result.add_subparsers(dest="task", required=True)
    bag = sub.add_parser("record", help="Publish synthetic odometry, record received messages and read the bag back.")
    bag.add_argument("directory", type=Path)
    bag.add_argument("--speed", type=float, default=0.25)
    bag.add_argument("--samples", type=int, default=50)
    move = sub.add_parser("plan", help="Request a trajectory from a local synthetic MoveIt planning service.")
    move.add_argument("output", type=Path)
    move.add_argument("--group", default="packaging_arm", choices=["packaging_arm"])
    move.add_argument("--joint", action="append", metavar="NAME=RAD")
    return result


def limits(args):
    if args.task == "record":
        if not math.isfinite(args.speed) or not 0 < args.speed <= 2 or not 2 <= args.samples <= 500:
            raise ValueError("Choose speed (0, 2] m/s and 2 to 500 samples.")
        if args.directory.exists():
            raise ValueError("Choose a new bag directory.")
    else:
        if args.output.exists():
            raise ValueError("Choose a new recording file.")
        args.joint = args.joint or ["shoulder=0.4", "elbow=0.8"]
        if len(args.joint) > 2:
            raise ValueError("Use a group identifier and at most twelve joint constraints.")
        goal = {}
        for specification in args.joint:
            name, angle = specification.split("=", 1)
            value = float(angle)
            if name not in ("shoulder", "elbow") or name in goal or not math.isfinite(value) or abs(value) > math.pi:
                raise ValueError("Each joint must have a unique identifier and angle within ±π rad.")
            goal[name] = value
        return goal


def provenance(source, frame, samples):
    try:
        client_version = version("rclpy")
    except PackageNotFoundError:
        client_version = "unreported"
    return {"schema":"oia.motion-record/1","source":source,"rosDistro":os.environ.get("ROS_DISTRO","unreported"),
            "clientVersion":client_version,"frame":frame,"units":"SI","samples":samples}

def write_record(path, record):
    with path.open("x", encoding="utf-8") as stream:
        json.dump(record, stream, allow_nan=False)

def record(args, rclpy):
    import rosbag2_py
    from geometry_msgs.msg import TransformStamped
    from nav_msgs.msg import Odometry
    from rclpy.qos import QoSProfile, ReliabilityPolicy
    from rclpy.serialization import deserialize_message, serialize_message
    from tf2_ros import TransformBroadcaster

    writer = rosbag2_py.SequentialWriter()
    options = rosbag2_py.StorageOptions(uri=str(args.directory), storage_id="sqlite3")
    converter = rosbag2_py.ConverterOptions("cdr", "cdr")
    writer.open(options, converter)
    topic = "/oia_workshop/wheel/odom"
    writer.create_topic(rosbag2_py.TopicMetadata(id=0, name=topic, type="nav_msgs/msg/Odometry", serialization_format="cdr"))
    sender = rclpy.create_node("encoder", namespace="/oia_workshop")
    receiver = rclpy.create_node("recorder", namespace="/oia_workshop")
    qos = QoSProfile(depth=16, reliability=ReliabilityPolicy.RELIABLE)
    publisher = sender.create_publisher(Odometry, topic, qos)
    tf = TransformBroadcaster(sender)
    received = []
    def observe(message):
        stamp = message.header.stamp
        ns = stamp.sec * 1_000_000_000 + stamp.nanosec
        writer.write(topic, serialize_message(message), ns)
        received.append(message.pose.pose.position.x)
    receiver.create_subscription(Odometry, topic, observe, qos)
    try:
        until = time.monotonic() + 5
        while publisher.get_subscription_count() == 0 and time.monotonic() < until:
            rclpy.spin_once(receiver, timeout_sec=0.05)
        if publisher.get_subscription_count() == 0:
            raise RuntimeError("No matching local odometry subscription.")
        for tick in range(args.samples):
            message = Odometry()
            message.header.stamp.sec, message.header.stamp.nanosec = divmod(tick * 100_000_000, 1_000_000_000)
            message.header.frame_id = "oia_odom"
            message.child_frame_id = "oia_base"
            message.pose.pose.position.x = tick * 0.1 * args.speed
            message.pose.pose.orientation.w = 1.0
            message.twist.twist.linear.x = args.speed
            transform = TransformStamped()
            transform.header = message.header
            transform.child_frame_id = message.child_frame_id
            transform.transform.translation.x = message.pose.pose.position.x
            transform.transform.rotation.w = 1.0
            tf.sendTransform(transform)
            publisher.publish(message)
            until = time.monotonic() + 2
            while len(received) <= tick and time.monotonic() < until:
                rclpy.spin_once(receiver, timeout_sec=0.05)
            if len(received) != tick + 1:
                raise RuntimeError("Receiver missed a sample; inspect the partial bag.")
    finally:
        sender.destroy_node()
        receiver.destroy_node()
        del writer
    reader = rosbag2_py.SequentialReader()
    reader.open(options, converter)
    restored = []
    while reader.has_next():
        name, data, timestamp = reader.read_next()
        if name == topic:
            message = deserialize_message(data, Odometry)
            restored.append((timestamp, message.pose.pose.position.x))
    if len(restored) != args.samples or any(t != i*100_000_000 or abs(x-i*.1*args.speed)>1e-9 for i,(t,x) in enumerate(restored)):
        raise RuntimeError("Bag contents disagree with the commanded constant-speed trace.")
    out = args.directory / "observations.json"
    write_record(out,provenance("ros2-odometry","oia_odom",[{"timeS":stamp/1e9,"xM":x} for stamp,x in restored]))
    return {"recording":str(out),"source":"live-ros2-subscription","topic":topic,"samples":len(restored),"lastXM":restored[-1][1],"bag":str(args.directory)}


def plan(args, goal, rclpy):
    from moveit_msgs.msg import Constraints, JointConstraint
    from moveit_msgs.srv import GetMotionPlan
    from rclpy.parameter_client import AsyncParameterClient
    node = rclpy.create_node("planning_request", namespace="/oia_workshop")
    try:
        model = (Path(__file__).resolve().parent / "ros2" / "training.urdf").read_text(encoding="utf-8")
        parameters = AsyncParameterClient(node,"/oia_workshop/move_group")
        if not parameters.wait_for_services(timeout_sec=3):
            raise RuntimeError("Training planner parameters unavailable.")
        verified = parameters.get_parameters(["robot_description", "allow_trajectory_execution"])
        rclpy.spin_until_future_complete(node,verified,timeout_sec=4)
        if not verified.done():
            raise RuntimeError("Training scene verification timed out.")
        values = verified.result().values
        if len(values)!=2 or values[0].type!=4 or values[0].string_value!=model or values[1].type!=1 or values[1].bool_value:
            raise RuntimeError("Only the supplied planning-only training scene is accepted.")
        client = node.create_client(GetMotionPlan, "/oia_workshop/plan_kinematic_path")
        if not client.wait_for_service(timeout_sec=3):
            raise RuntimeError("No synthetic MoveIt planning service at /oia_workshop/plan_kinematic_path.")
        request = GetMotionPlan.Request()
        motion = request.motion_plan_request
        motion.group_name = args.group
        motion.allowed_planning_time = 3.0
        motion.num_planning_attempts = 2
        motion.max_velocity_scaling_factor = 0.1
        motion.max_acceleration_scaling_factor = 0.1
        motion.start_state.is_diff = True
        constraints = Constraints()
        for name, value in goal.items():
            j = JointConstraint()
            j.joint_name = name
            j.position = value
            j.tolerance_above = j.tolerance_below = 0.01
            j.weight = 1.0
            constraints.joint_constraints.append(j)
        motion.goal_constraints = [constraints]
        future = client.call_async(request)
        rclpy.spin_until_future_complete(node, future, timeout_sec=8)
        if not future.done():
            raise RuntimeError("No planner response within eight seconds.")
        result = future.result().motion_plan_response
        trajectory = result.trajectory.joint_trajectory
        if result.error_code.val != 1 or not trajectory.points:
            raise RuntimeError("Planner returned code " + str(result.error_code.val))
        end = dict(zip(trajectory.joint_names, trajectory.points[-1].positions, strict=True))
        if any(name not in end or abs(end[name]-value)>0.010001 for name,value in goal.items()):
            raise RuntimeError("Planned endpoint violates a requested joint constraint.")
        names=list(trajectory.joint_names)
        if set(names)!={"shoulder","elbow"} or len(trajectory.points)>5000:
            raise RuntimeError("Unexpected training trajectory joint map or length.")
        samples=[]
        for point in trajectory.points:
            stamp=point.time_from_start
            joint=dict(zip(names,point.positions,strict=True))
            samples.append({"timeS":stamp.sec+stamp.nanosec/1e9,"shoulderRad":joint["shoulder"],"elbowRad":joint["elbow"]})
        if len(samples)<2 or any(s["timeS"]<0 or (i and s["timeS"]<=samples[i-1]["timeS"]) for i,s in enumerate(samples)):
            raise RuntimeError("Planner did not return a time-parameterised trajectory.")
        recording=provenance("moveit-plan","base",samples)
        recording["modelSha256"]=hashlib.sha256(model.encode()).hexdigest()
        write_record(args.output,recording)
        return {"recording":str(args.output),"source":"live-moveit-planning-service","points":len(trajectory.points),"planningSeconds":result.planning_time,"endpointRad":end}
    finally:
        node.destroy_node()


def main():
    args = parser().parse_args()
    goal = limits(args)
    os.environ.update(ROS_DOMAIN_ID="72", ROS_LOCALHOST_ONLY="1", ROS_AUTOMATIC_DISCOVERY_RANGE="LOCALHOST", ROS_STATIC_PEERS="")
    import rclpy
    rclpy.init(args=[])
    try:
        print(json.dumps(record(args,rclpy) if args.task=="record" else plan(args,goal,rclpy), indent=2))
    finally:
        rclpy.shutdown()


if __name__ == "__main__":
    try:
        main()
    except (ImportError, RuntimeError, ValueError, OSError) as error:
        raise SystemExit(str(error)) from None
