from pathlib import Path

from launch import LaunchDescription
from launch.actions import SetEnvironmentVariable
from launch_ros.actions import Node


def generate_launch_description():
    folder = Path(__file__).resolve().parent
    namespace = "oia_workshop"
    description = {"robot_description": (folder / "training.urdf").read_text(encoding="utf-8")}
    motion = {
        "robot_description_semantic": (folder / "training.srdf").read_text(encoding="utf-8"),
        "allow_trajectory_execution": False,
        "disable_capabilities": "move_group/MoveGroupExecuteTrajectoryAction",
        "planning_pipelines": ["ompl"], "default_planning_pipeline": "ompl",
        "ompl.planning_plugins": ["ompl_interface/OMPLPlanner"],
        "ompl.request_adapters": ["default_planning_request_adapters/ValidateWorkspaceBounds",
                                  "default_planning_request_adapters/CheckStartStateBounds",
                                  "default_planning_request_adapters/CheckStartStateCollision"],
        "ompl.response_adapters": ["default_planning_response_adapters/AddTimeOptimalParameterization",
                                   "default_planning_response_adapters/ValidateSolution"],
        "ompl.planner_configs.RRTConnect.type": "geometric::RRTConnect",
        "ompl.packaging_arm.planner_configs": ["RRTConnect"],
    }
    for joint in ("shoulder", "elbow"):
        key = "robot_description_planning.joint_limits." + joint
        motion.update({key+".has_acceleration_limits": True, key+".max_acceleration": 2.0,
                       key+".has_velocity_limits": True, key+".max_velocity": 1.4})
    common = {"namespace": namespace, "output": "screen",
              "remappings": [("/joint_states", "/oia_workshop/joint_states"),
                             ("/tf", "/oia_workshop/tf"), ("/tf_static", "/oia_workshop/tf_static")]}
    return LaunchDescription([
        SetEnvironmentVariable("ROS_DOMAIN_ID", "72"),
        SetEnvironmentVariable("ROS_LOCALHOST_ONLY", "1"),
        SetEnvironmentVariable("ROS_AUTOMATIC_DISCOVERY_RANGE", "LOCALHOST"),
        SetEnvironmentVariable("ROS_STATIC_PEERS", ""),
        Node(package="robot_state_publisher", executable="robot_state_publisher", parameters=[description], **common),
        Node(package="joint_state_publisher", executable="joint_state_publisher", parameters=[description], **common),
        Node(package="moveit_ros_move_group", executable="move_group", name="move_group",
             parameters=[description,motion], **common)
    ])
