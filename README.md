# CDTI Signal Explorer

An interactive view of one diffusion-weighted image of a mid-ventricular short-axis slice. Move the
b-vector and watch the signal change in every voxel, with $S/S_0 = \exp(-b\,\mathbf{g}^T\mathbf{D}\,\mathbf{g})$.

**Live version:** <!-- TODO: GitHub Pages URL -->
**Related:** [CDTI Angles Explorer](https://github.com/samcoveney/CDTI_Angles_Explorer)

## Run it locally
Open `index.html` in a browser. It is one self-contained file and works offline, with fallback fonts.

## What it shows

- Geometry: the equator of the CDTI_Angles Figure 1 spheroid (cavity diameter 38 mm, wall 10 mm), with
  2.5 mm voxels. The slice is perpendicular to the LV long axis.
- Tensor: `makeFibre(HA, IA, RA)`, the same forward model as the CDTI Angles Explorer.
- Tensor glyph: the selected voxel's tensor as a rotatable superquadric (Kindlmann 2004, sharpness 3), written into the page with no dependencies. It reaches each eigenvalue along its eigenvector, on a fixed scale. Its edges show the axes where an ellipsoid's outline can mislead, and it turns round about e1 when $\lambda_2 = \lambda_3$. It is not a diffusivity profile.
- Defaults are illustrative: HA +60° to -60°, IA 0°, RA 40°, eigenvalues 1.7, 1.0, 0.5 × 10⁻³ mm²/s, b = 500 s/mm².

## Tests
`tests/test_math.js` checks the page's maths (the `signal_math` block in `index.html`) against values
worked out by hand. Run it with [Deno](https://deno.com):

    deno run --allow-read tests/test_math.js

## Reference
Kindlmann G. Superquadric Tensor Glyphs. Joint Eurographics - IEEE TCVG Symposium on Visualization, 2004.

## Licence
MIT; see `LICENSE`.
