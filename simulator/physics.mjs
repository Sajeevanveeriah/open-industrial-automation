// Component units: kg. Time: s. Temperature: deg C. These are uncalibrated study models.
export const COMPONENTS = Object.freeze(['water', 'dry', 'oil', 'coat']);
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const mass = (p) => COMPONENTS.reduce((sum, key) => sum + p[key], 0);
export const zeroComponents = () => ({water:0,dry:0,oil:0,coat:0});
export function addComponents(target, source, scale = 1) {
  for (const key of COMPONENTS) target[key] += source[key] * scale;
}
export function splitParcel(parcel, kg) {
  const available = mass(parcel);
  if (!Number.isFinite(kg) || kg < 0 || kg > available + 1e-7) throw new RangeError('Invalid parcel split');
  const ratio = available > 0 ? Math.min(1, kg / available) : 0;
  const part = {...parcel, holdReasons:[...parcel.holdReasons]};
  for (const key of COMPONENTS) {
    part[key] = parcel[key] * ratio;
    parcel[key] -= part[key];
  }
  return part;
}
export function thermal(initial, medium, seconds, tau) {
  if (![initial,medium,seconds,tau].every(Number.isFinite) || seconds < 0 || tau <= 0) throw new RangeError('Invalid thermal input');
  return medium + (initial - medium) * Math.exp(-seconds / tau);
}
export function dwell(stage, recipe) {
  if ((stage.id === 'peel' && recipe.skinOn) || (stage.id === 'coat' && !recipe.coatFraction) || (stage.id === 'form' && !recipe.formed)) return 1;
  return (stage.id === 'freeze' ? recipe.freezeS : stage.dwellS) / stage.speed;
}
export function outputFactor(id, recipe, faults) {
  if (id === 'wash') return 0.985;
  if (id === 'peel') return recipe.skinOn ? 1 : 0.925;
  if (id === 'sort') return faults.includes('sorter-rejects') ? 0.8 : 0.985;
  if (id === 'cut') return 0.96;
  if (id === 'blanch') return 1.015;
  if (id === 'dry') return 0.94;
  if (id === 'coat') return 1 + recipe.coatFraction;
  if (id === 'fry') return 0.86;
  return 1;
}
const hold = (parcel, reason) => { if (!parcel.holdReasons.includes(reason)) parcel.holdReasons.push(reason); };
export function transformParcel(input, stage, recipe, loops, faults, time) {
  const p = {...input,holdReasons:[...input.holdReasons]};
  const before = mass(p);
  const waste = zeroComponents();
  const additions = zeroComponents();
  let vapourKg = 0;
  const residence = Math.max(0, time - input.entered);
  const reject = stage.id === 'wash' ? 0.015 : stage.id === 'peel' && !recipe.skinOn ? 0.075 : stage.id === 'sort' ? (faults.includes('sorter-rejects') ? 0.2 : 0.015) : stage.id === 'cut' ? 0.04 : 0;
  for (const key of COMPONENTS) {waste[key] = p[key] * reject; p[key] -= waste[key];}
  if (stage.id === 'peel' && !recipe.skinOn) p.tempC = thermal(p.tempC, 100, Math.min(residence,45), 65);
  if (stage.id === 'blanch') {
    additions.water = before * 0.015;
    p.water += additions.water;
    p.tempC = thermal(p.tempC, loops.blanch.pv, residence, 70);
    if (loops.blanch.pv < 72 || loops.blanch.pv > 95) hold(p,'Blancher process temperature outside illustrative window');
    if (residence > 600) hold(p,'Excess blanching residence');
  }
  if (stage.id === 'dry') {
    vapourKg = Math.min(p.water,before * 0.06);
    p.water -= vapourKg;
    p.tempC = thermal(p.tempC,60,residence,90);
  }
  if (stage.id === 'coat') {additions.coat = before * recipe.coatFraction; p.coat += additions.coat;}
  if (stage.id === 'fry') {
    vapourKg = Math.min(p.water,before * 0.18);
    p.water -= vapourKg;
    additions.oil = before * 0.04;
    p.oil += additions.oil;
    p.tempC = thermal(p.tempC,Math.min(100,loops.fry.pv),residence,45);
    if (loops.fry.pv < 162 || loops.fry.pv > 190) hold(p,'Fryer process temperature outside illustrative window');
    if (residence > 300) hold(p,'Excess hot residence after interruption');
  }
  if (stage.id === 'cool') p.tempC = thermal(p.tempC,20,residence,25);
  if (stage.id === 'freeze') {
    p.tempC = thermal(p.tempC,loops.freeze.pv,residence,recipe.freezeTauS);
    if (p.tempC > -18) hold(p,'Frozen product core above illustrative -18 deg C release limit');
  }
  if (stage.id === 'inspect' && faults.includes('metal-detect')) hold(p,'Foreign-body inspection failure');
  if (p.sugar > 0.35) hold(p,'Raw reducing-sugar sample outside illustrative acceptance');
  return {parcel:p,waste,additions,vapourKg};
}
export function piStep(loop, {enabled, capacity, load, bias = 0}) {
  loop.measured = loop.pv + bias;
  const error = loop.cooling ? loop.measured - loop.sp : loop.sp - loop.measured;
  // Feed-forward is the inverse of the declared first-order plant, with bounded PI correction.
  const required = loop.cooling ? (20 + load - loop.sp) / loop.gain * 100 : (loop.sp - 20 + load) / loop.gain * 100;
  const proposed = required + loop.kp * error + loop.integral;
  const bounded = clamp(proposed,0,100);
  if (enabled && capacity > 0 && (proposed === bounded || (proposed > 100 && error < 0) || (proposed < 0 && error > 0))) loop.integral = clamp(loop.integral + loop.ki * error,-100,100);
  loop.output = enabled ? bounded * capacity : 0;
  const equilibrium = loop.cooling ? 20 + load - loop.gain * loop.output / 100 : 20 - load + loop.gain * loop.output / 100;
  loop.pv = thermal(loop.pv,equilibrium,1,enabled ? loop.tau : 450);
  loop.measured = loop.pv + bias;
  loop.error = loop.cooling ? loop.measured - loop.sp : loop.sp - loop.measured;
}
