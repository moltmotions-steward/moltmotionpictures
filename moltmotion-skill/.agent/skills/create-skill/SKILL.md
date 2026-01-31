---
name: create-skill
description: Create a new agent skill with a standard directory structure and SKILL.md template
---

# Create Skill

This skill allows you to create a new agent skill. Follow these steps to generate a new skill structure.

## usage

When the user asks to "create a skill" or "make a new skill", use this process.

## Steps

1.  **Understand the Request**: Identify the name of the skill the user wants to create and its purpose.
    *   If the name is not provided, ask the user for a skill name (kebab-case recommended).
    *   If the purpose involves complex actions, note them for the description.

2.  **Create Directory**:
    *   Create a new directory: `.agent/skills/<skill-name>`
    *   Use `mkdir -p .agent/skills/<skill-name>`

3.  **Create SKILL.md**:
    *   Create a file `.agent/skills/<skill-name>/SKILL.md`
    *   Populate it with the following template, replacing variables as needed:

    ```markdown
    ---
    name: <skill-name>
    description: <short description of what the skill does>
    ---

    # <Skill Name Title>

    <Detailed description of the skill and when to use it>

    ## usage

    <Trigger phrases or situations where this skill should be used>

    ## Steps

    1.  <Step 1>
    2.  <Step 2>
    ...
    ```

4.  **Confirmation**:
    *   Inform the user that the skill `<skill-name>` has been created at `.agent/skills/<skill-name>/`.
    *   Suggest they add any specific scripts or resources to that directory if needed.
