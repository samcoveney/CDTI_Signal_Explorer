// Check the page's maths (the signal_math block in index.html) against values worked out by hand.
// Run:  deno run --allow-read tests/test_math.js

const html = await Deno.readTextFile(new URL("../index.html", import.meta.url));
const block = html.split("// BEGIN signal_math")[1].split("// END signal_math")[0];
const { makeFibre, localFrame, wallVoxels, voxelTensor, diffusivity, signal, dot, cross, glyphSemiAxes, superquadricShape, superquadricPoint, superquadricValue, superquadricReach, viewBasis, toView, DEG } = new Function(
  block + "\nreturn { makeFibre, localFrame, wallVoxels, voxelTensor, diffusivity, signal, dot, cross, glyphSemiAxes, superquadricShape, superquadricPoint, superquadricValue, superquadricReach, viewBasis, toView, DEG };",
)();

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "pass" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!ok) failed++;
}
const close = (a, b, tol = 1e-12) => Math.abs(a - b) < tol;
const closeVec = (a, b, tol = 1e-12) => a.every((v, k) => close(v, b[k], tol));

const lambdas = [1.7, 1.0, 0.5];
const rules = { haEndo: 60, haEpi: -60, ia: 15, ra: 40 };
const voxels = wallVoxels();
const at = (depth, x, y) => voxelTensor({ x, y, depth }, rules);

// The frame at (x, y) = (24, 0) is r = x, c = y, l = z, so local and image coordinates agree there.
const f0 = localFrame(24, 0);
check("frame at +x is r=x, c=y, l=z", closeVec(f0.r, [1, 0, 0]) && closeVec(f0.c, [0, 1, 0]) && closeVec(f0.l, [0, 0, 1]));
const f90 = localFrame(0, 24);
check("frame at +y is r=y, c=-x", closeVec(f90.r, [0, 1, 0]) && closeVec(f90.c, [-1, 0, 0]));
check("frame is right-handed everywhere", voxels.every((v) => {
  const { r, c, l } = localFrame(v.x, v.y);
  return closeVec(cross(r, c), l);
}));

// Eigenvectors: orthonormal and right-handed in every voxel.
check("eigenvectors orthonormal and right-handed in every voxel", voxels.every((v) => {
  const t = voxelTensor(v, rules);
  return close(dot(t.e1, t.e1), 1) && close(dot(t.e2, t.e2), 1) && close(dot(t.e3, t.e3), 1) &&
    close(dot(t.e1, t.e2), 0) && close(dot(t.e1, t.e3), 0) && close(dot(t.e2, t.e3), 0) &&
    closeVec(cross(t.e1, t.e2), t.e3);
}));

// The local fibre for hand-worked angles: HA 60, IA 0 gives e1 = (0, cos 60, sin 60).
check("e1 at HA 60, IA 0", closeVec(makeFibre(60, 0, 0).e1, [0, 0.5, Math.sqrt(3) / 2]));
check("e1 at IA 90 is radial", closeVec(makeFibre(0, 90, 0).e1, [1, 0, 0]));
check("e2 at HA 0, RA 0 is l", closeVec(makeFibre(0, 0, 0).e2, [0, 0, 1]));

// Signal: exp(-b * lambda) along each eigenvector, and g, -g the same.
const t = at(0.3, 20, 10);
check("signal along e1 is exp(-b lambda1)", close(signal(t, lambdas, t.e1, 500), Math.exp(-0.85)));
check("signal along e2 is exp(-b lambda2)", close(signal(t, lambdas, t.e2, 500), Math.exp(-0.5)));
check("signal along e3 is exp(-b lambda3)", close(signal(t, lambdas, t.e3, 500), Math.exp(-0.25)));
check("signal is 1 at b = 0", close(signal(t, lambdas, [0, 0, 1], 0), 1));
const g = [0.6, 0, 0.8];
check("g and -g give the same signal", close(signal(t, lambdas, g, 500), signal(t, lambdas, [-0.6, 0, -0.8], 500)));

// lambda2 = lambda3: RA has no effect. lambda2 != lambda3: it does.
const noRoll = [1.7, 0.75, 0.75];
const ra0 = voxelTensor({ x: 20, y: 10, depth: 0.3 }, { ...rules, ra: 0 });
const ra70 = voxelTensor({ x: 20, y: 10, depth: 0.3 }, { ...rules, ra: 70 });
check("RA has no effect when lambda2 = lambda3", close(signal(ra0, noRoll, g, 500), signal(ra70, noRoll, g, 500)));
check("RA has an effect when lambda2 != lambda3", !close(signal(ra0, lambdas, g, 500), signal(ra70, lambdas, g, 500), 1e-3));

// The patterns the tool is meant to show, with HA +60 to -60 and IA 0.
const flat = { haEndo: 60, haEpi: -60, ia: 0, ra: 40 };
const mid = voxels.filter((v) => Math.abs(v.depth - 0.5) < 0.15);
const ofMid = (gv) => mid.map((v) => ({ v, s: signal(voxelTensor(v, flat), lambdas, gv, 500) }));
const darkestX = ofMid([1, 0, 0]).reduce((a, b) => (b.s < a.s ? b : a));
const brightestX = ofMid([1, 0, 0]).reduce((a, b) => (b.s > a.s ? b : a));
check("g along x: mid-wall darkest at top or bottom", Math.abs(darkestX.v.y) > 3 * Math.abs(darkestX.v.x),
  `(${darkestX.v.x}, ${darkestX.v.y}) S=${darkestX.s.toFixed(3)}`);
check("g along x: mid-wall bright at the sides", Math.abs(brightestX.v.x) > Math.abs(brightestX.v.y),
  `(${brightestX.v.x}, ${brightestX.v.y}) S=${brightestX.s.toFixed(3)}`);
const meanAtZ = (test) => {
  const list = voxels.filter(test).map((v) => signal(voxelTensor(v, flat), lambdas, [0, 0, 1], 500));
  return list.reduce((a, b) => a + b, 0) / list.length;
};
const endo = meanAtZ((v) => v.depth < 0.2), middle = meanAtZ((v) => Math.abs(v.depth - 0.5) < 0.1), epi = meanAtZ((v) => v.depth > 0.8);
check("g along z: endo and epi darker than mid-wall", endo < middle && epi < middle,
  `endo ${endo.toFixed(3)}, mid ${middle.toFixed(3)}, epi ${epi.toFixed(3)}`);

// Grid: every wall voxel's centre lies in the annulus, and the wall spans about four voxels.
check("wall voxels all within the annulus", voxels.every((v) => {
  const rho = Math.hypot(v.x, v.y);
  return rho >= 19 && rho <= 29 && v.depth >= 0 && v.depth <= 1;
}));
check("wall voxel count is close to the annulus area", Math.abs(voxels.length - Math.PI * (29 ** 2 - 19 ** 2) / 2.5 ** 2) < 12, `${voxels.length} voxels`);

// The superquadric glyph (Kindlmann 2004).
check("semi-axes are lambda / 2.5", closeVec(glyphSemiAxes([2.5, 1.25, 0.5]), [1, 0.5, 0.2]));
const defaultShape = superquadricShape(lambdas);
check("default eigenvalues: planar branch, exponents by hand", !defaultShape.linear &&
  close(defaultShape.alpha, (1 - 0.7 / 3.2) ** 3, 1e-12) && close(defaultShape.beta, (1 - 2 * 0.5 / 3.2) ** 3, 1e-12),
  `alpha ${defaultShape.alpha.toFixed(3)}, beta ${defaultShape.beta.toFixed(3)}`);
const iso = superquadricShape([1, 1, 1]);
check("isotropic: exponents 1, so a sphere", close(iso.alpha, 1) && close(iso.beta, 1));
const noRollShape = superquadricShape([1.7, 0.75, 0.75]);
check("lambda2 = lambda3: linear branch with alpha 1", noRollShape.linear && close(noRollShape.alpha, 1));
const circle = [0.3, 1.1, 2.2, 4].map((t) => {
  const q = superquadricPoint(noRollShape, t, Math.PI / 3);
  return Math.hypot(q[1], q[2]);
});
check("lambda2 = lambda3: the cross-section around e1 is a circle", circle.every((r) => close(r, circle[0], 1e-12)));
const disc = superquadricShape([1.5, 1.5, 0.3]);
const discRing = [0.3, 1.1, 2.2, 4].map((t) => {
  const q = superquadricPoint(disc, t, Math.PI / 3);
  return Math.hypot(q[0], q[1]);
});
check("lambda1 = lambda2: a disc, circular around e3", !disc.linear && discRing.every((r) => close(r, discRing[0], 1e-12)));

const shapes = [[1.7, 1, 0.5], [1.7, 0.75, 0.75], [1.5, 1.4, 0.3], [1, 1, 1], [2.5, 0.05, 0.05], [2, 1.1, 0.2], [0, 0, 0]];
check("tips of the unit shape are on the axes, in both directions", shapes.every((l) => {
  const shape = superquadricShape(l);
  const ends = shape.linear
    ? [[0, 0, [1, 0, 0]], [0, Math.PI, [-1, 0, 0]], [Math.PI / 2, Math.PI / 2, [0, -1, 0]], [0, Math.PI / 2, [0, 0, 1]]]
    : [[0, 0, [0, 0, 1]], [0, Math.PI, [0, 0, -1]], [0, Math.PI / 2, [1, 0, 0]], [Math.PI / 2, Math.PI / 2, [0, 1, 0]]];
  return ends.every(([t, f, want]) => closeVec(superquadricPoint(shape, t, f), want, 1e-6));
}));
check("mesh points satisfy the implicit form", shapes.every((l) => {
  const shape = superquadricShape(l);
  return [[0.4, 0.7], [1.3, 1.1], [2.5, 2.1], [4.2, 0.9], [5.5, 2.6]].every(([t, f]) =>
    close(superquadricValue(shape, superquadricPoint(shape, t, f)), 1, 1e-6));
}));
check("the shape is continuous where the branches meet", (() => {
  const shape = superquadricShape([1.5, 1, 0.5 - 1e-9]);
  const other = superquadricShape([1.5, 1, 0.5 + 1e-9]);
  return close(shape.alpha, other.alpha, 1e-6) && close(shape.beta, other.beta, 1e-6);
})());
check("reach along an eigenvector is its semi-axis", shapes.every((l) => {
  const shape = superquadricShape(l), a = glyphSemiAxes(l);
  return close(superquadricReach(shape, a, [1, 0, 0]), a[0], 1e-9) && close(superquadricReach(shape, a, [0, 1, 0]), a[1], 1e-9) && close(superquadricReach(shape, a, [0, 0, 1]), a[2], 1e-9);
}));
check("reach lands on the surface in any direction", shapes.every((l) => {
  const shape = superquadricShape(l), a = glyphSemiAxes(l);
  return [[0.6, 0, 0.8], [0.3, 0.5, Math.sqrt(1 - 0.34)], [-0.7, 0.7, Math.sqrt(0.02)]].every((d) => {
    const t = superquadricReach(shape, a, d);
    return Number.isFinite(t) && t > 0 && close(superquadricValue(shape, d.map((v, k) => t * v / a[k])), 1, 1e-6);
  });
}));

// The view: right-handed, and az 0, el 90 is the image's own view.
const image = viewBasis(0, 90);
check("az 0, el 90 is the image view", closeVec(image.u, [1, 0, 0]) && closeVec(image.v, [0, 1, 0]) && closeVec(image.w, [0, 0, 1]));
check("views are right-handed and orthonormal", [[-30, 25], [120, -40], [200, 80]].every(([az, el]) => {
  const b = viewBasis(az, el);
  return closeVec(cross(b.u, b.v), b.w) && close(dot(b.u, b.u), 1) && close(dot(b.v, b.v), 1);
}));
check("z points up the screen in an ordinary view", viewBasis(-30, 25).v[2] > 0 && close(viewBasis(-30, 25).u[2], 0));

console.log(failed ? `${failed} FAILED` : "ALL PASS");
if (failed) Deno.exit(1);
