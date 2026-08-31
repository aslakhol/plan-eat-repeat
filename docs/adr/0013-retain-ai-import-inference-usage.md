# Retain AI import inference usage

Plan Eat Repeat retains the provider ID, requested model ID, response model ID, and total input and output tokens for each AI Import Attempt. This amends ADR-0012 so production usage can inform a safe output-token limit while still omitting imported content, product outcome, provider request identifiers, and raw provider usage.
