# Development Strategy

This document defines the team's Git workflow, commit conventions, Pull
Request and Code Review process, task tracking practices, and
setup/testing/deployment expectations for the Vaka project.

## 1. Branching Strategy

To keep development organized and prevent unreviewed changes, the
project uses the `main` branch and separate branches for individual
tasks.

### Main Branch Rules

-   `main` holds the integrated, dependable version of the project.
-   Do not commit directly to `main`.
-   All changes must be reviewed through a Pull Request before merging.
-   Create each task branch from the latest version of `main`.
-   Keep each branch focused on one task or related change.

### Branch Naming

  Prefix     Purpose                         Example
  ---------- ------------------------------- --------------------------
  `feat/`    Add a feature                   `feat/user-registration`
  `fix/`     Fix a bug                       `fix/login-validation`
  `docs/`    Update documentation            `docs/project-readme`
  `test/`    Add or update tests             `test/task-creation`
  `chore/`   Configuration and maintenance   `chore/project-setup`

Naming rules:

-   Use lowercase English letters.
-   Separate words with hyphens (`-`).
-   Keep branch names short, clear, and related to the task.
-   If task IDs are used, include them when appropriate; for example,
    `feat/T1-03-user-registration`.

Create a branch from the latest `main`:

``` bash
git switch main
git pull origin main
git switch -c feat/user-registration
```

Replace `feat/user-registration` with the appropriate branch name for
your task.

## 2. Commit Message Convention

Use this format:

``` text
type: short description
```

  --------------------------------------------------------------------------------------
  Prefix                  Purpose                 Example
  ----------------------- ----------------------- --------------------------------------
  `feat:`                 Add a feature           `feat: add user registration`

  `fix:`                  Fix a bug               `fix: validate login credentials`

  `docs:`                 Update documentation    `docs: update project README`

  `test:`                 Add or update tests     `test: add task creation tests`

  `refactor:`             Refactor without        `refactor: simplify task validation`
                          changing expected       
                          behavior                

  `style:`                Formatting or style     `style: format Python files`
                          changes without logic   
                          changes                 

  `chore:`                Configuration and       `chore: configure gitignore`
                          maintenance             
  --------------------------------------------------------------------------------------

Commit message rules:

-   Clearly state what changed.
-   Avoid vague messages such as `update`, `changes`, or `final`.
-   Keep each commit focused on one logical change where possible.
-   Write commit messages in English and use lowercase descriptions.
-   For complex changes, add details in the commit body.
-   If an Issue exists, reference its ID in the commit message or
    related description.

## 3. Pull Request and Code Review Process

All changes must enter `main` through a Pull Request:

1.  Update your local copy of `main`.

2.  Create a branch for the task.

3.  Implement the change and create commits using the agreed convention.

4.  Push the branch to the shared repository. For example:

    ``` bash
    git push -u origin feat/user-registration
    ```

5.  Open a Pull Request on GitHub with `main` as the base branch.

6.  Describe the purpose of the change, the affected areas, the related
    Issue, and how it was tested.

7.  Request a review from at least one other team member.

8.  Address review comments and make the required corrections.

9.  Merge only after the required approval is received, important review
    conversations are resolved, and required checks pass.

### Review Rules

-   Authors must not approve their own Pull Requests.
-   Each Pull Request must receive at least one approval from another
    team member.
-   Review code for correctness, readability, and potential defects.
-   Required automated tests and checks must pass before merging.
-   Protect `main` using the branch protection features available in the
    GitHub plan.

## 4. Issue and Task Management

Tasks and bugs must be tracked in a project-management system. The final
approach will be agreed on by the team; GitHub Issues and GitHub
Projects are options to consider.

For each task or bug, where applicable:

-   Use a clear title and actionable description.
-   Assign an owner.
-   Apply labels such as `bug`, `feature`, and `chore`.
-   Keep the status up to date.
-   Link the Issue to the relevant branch and Pull Request.
-   Define acceptance criteria and a testing approach before closing the
    task.

## 5. Setup, Testing, and Deployment

Installation, local execution, testing, and deployment instructions will
be completed after the remaining technical decisions are finalized and
the actual project files exist. Commands or workflows that depend on
unselected technologies are not assumed in this version.

  -----------------------------------------------------------------------
  Area                                Status
  ----------------------------------- -----------------------------------
  Dependency installation and local   To be documented after setup
  development                         decisions

  Environment variables               To be documented after setup
                                      decisions; secret values must not
                                      be published

  Test execution and coverage reports To be documented after testing
                                      tools are selected

  CI for pushes and Pull Requests     To be configured after build and
                                      test commands are defined

  Docker and Docker Compose           Subject to the final architecture
                                      and course requirements

  Staging environment and deployment  To be documented after
                                      infrastructure and access are
                                      decided

  Rollback procedure                  To be documented as part of the
                                      deployment process
  -----------------------------------------------------------------------
