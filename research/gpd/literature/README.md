# Literature

**No literature entries have been verified for this workspace.** That is deliberate. This directory stays empty rather than holding citations that nobody has checked.

The repository cites "Woodyard (2026), Field-Modulated Spatial Localization as a Dynamical Variable" as the source of the proposed model. That paper is not in the repository, and the equation numbers quoted in code comments have not been checked against it here.

## Rules for adding an entry

Each entry is one file containing:

1. a full citation with a DOI or arXiv identifier that resolves
2. the specific claim it supports, quoted or paraphrased with a page or equation number
3. who verified it, and how (read the paper; reproduced the number)
4. whether it supports an *established* baseline, constrains the *proposed* model, or only motivates it

A citation that mentions a topic without supporting the specific claim is not an entry. A literature value can never set an instrument sensitivity in `src/lib/observables.ts` without a verified entry here.

Open literature tasks for the two-site model:

- bounds on scalar couplings to matter from atom interferometry, clock comparisons and fifth-force searches. These become usable only once φ is identified with a physical field (see `REQUIREMENTS.md` E1).
- standard references for the two-level Rabi formula and the exponential midpoint rule, to anchor the baseline. Both are textbook results. Adding a verified reference would let the audit cite one.
