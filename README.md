Educational project for the course Introduction to Finance. Not a real product, service or investment offer. Do not use with real funds.

# AgriChain Final Project

Team 02, group SE-2517. This is the Final Project continuation of the team's AgriChain Endterm concept: traceability of synthetic grain and oilseed batches. It includes the final report, investor presentation, a local blockchain prototype and the course requirements.

## Submission materials

- [Final report PDF](deliverables/Team02_FP_Report.pdf): 15 pages from Introduction to Conclusion, plus references and Appendices A–E.
- [PowerPoint presentation](deliverables/Team02_FP_Presentation.pptx): 14 main slides and 3 backup slides, with speaker notes and editable tables, charts and a sequence diagram.
- [Course requirements](requirements/Final_Project_Requirements.docx).
- [Instructor's BlockSupply example](requirements/Final_Project_Example_BlockSupply.docx): a separate course reference, not our startup or financial model.

Repository: https://github.com/janbauyrzhan/AgriChain-Final-Project

## Demonstration video

[Watch the final team demonstration on Google Drive](https://drive.google.com/file/d/13M_peAYc0KzTbws3YfLRy78pVaor4h2Q/view?usp=drive_link) (1 minute 58 seconds).

The same video link appears on the report title page and the presentation title and demonstration slides. One common team demo of up to 3 minutes is required. The video is hosted on Google Drive.

## Install and run the local prototype

Install Node.js and npm, then run in this repository:

```text
npm ci
npm test
npm run demo
```

On Windows, `RUN_TESTS.cmd` and `RUN_DEMO.cmd` provide the test and demonstration commands. The first run installs the locked dependencies when needed. Solidity 0.8.24 is pinned as an npm dependency, so compilation uses the local compiler after installation.

For a persistent local node, run `npm run node` in one terminal, then `npm run deploy:local` or `npm run demo:local` in another. The configured networks are local Hardhat and localhost, chain ID 31337.

## Implemented workflow and evidence

The custodian registers G001 with 100,000 kg of synthetic wheat and attaches a document fingerprint. A sender dispatches it and a different receiver confirms receipt. A mismatched split is rejected. A valid split creates G001A and G001B with 50,000 kg each. A reviewer flags and resolves an issue. An unrelated account cannot register a batch.

- [Contract](contracts/AgriChainRegistry.sol)
- [Core tests](test/AgriChainRegistry.test.js)
- [Additional validation tests](test/Validation.test.js)
- [Automatic demonstration](scripts/demo.js)
- [Actual test output](evidence/test-results.txt)
- [Actual demo output](evidence/demo-results.txt)
- [Recorded demonstration events](evidence/demo-events.json)

The verified run on November 14, 2026 passed all 15 unit tests. All test data and accounts are synthetic. No tokens, payments, real funds, private keys or personal data appear in the prototype.

## Financial model

`python finance_model.py` uses Python's standard library to reproduce the annual and monthly scenarios. Monetary amounts are KZT million. The base case has three-year NPV **-36.75m** at 25%, with no payback within three operating years. A monthly liquidity check raises the original annual-only funding floor from **53.40m** to **55.5878m**, rounded upward to a **55.59m** classroom ask for 20% hypothetical equity. The two downside monthly funding floors are **76.51m** and **64.32m**. Inputs remain educational assumptions, not customer observations or supplier quotations.

## Boundaries

Hardhat is a local EVM demonstration. The conceptual Hyperledger Fabric consortium has not been deployed; porting Solidity logic to Fabric would require a new implementation and tests. Fingerprints can reveal a later file mismatch but do not certify source-document truth or physical grain quality. Role revocation, organisation-level ownership restrictions, confidential reads, multisignature administration and production recovery are absent. An issue flag does not automatically pause business actions. No independent security audit has occurred.

## Team contributions and AI disclosure

We outline our team roles in [CONTRIBUTIONS.md](CONTRIBUTIONS.md).

We used OpenAI ChatGPT and Codex (GPT-6) for help with our report, presentation, financial calculations, monthly cash flow model, and routine code and tests.

## Licence

The supplied educational contract retains its [MIT licence](LICENSE). No OpenZeppelin contract implementation is copied. Hardhat, its plugins and other dependencies retain their own licences and notices. The instructor's files in `requirements/` remain attributed course reference materials and are not presented as original Team 02 work.
