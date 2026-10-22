# Vaka

**A smart marketplace for delegating and completing everyday
micro-tasks**

Repository:
[MaryamM84/vaka-platform](https://github.com/MaryamM84/vaka-platform)

> **Project status:** In design and development. This document describes
> the project's intended goals and scope; it does not imply that every
> listed feature has already been implemented.

## Project Overview

Vaka is a software project designed to make it easier to post, delegate,
and track small, short-term everyday tasks. The platform aims to create
a more structured, transparent, and reliable connection between people
who need a task completed and people who have the time or skills to
complete it.

### Problem and Goal

Everyday tasks---such as collecting a parcel, buying needed items, or
picking up a gift---do not always fit easily into people's schedules.
Informal coordination can create problems around trust, agreeing on
costs, tracking progress, confirming completion, and handling payments.

Vaka aims to provide a unified platform where users can post task
requests, receive offers from taskers, select a suitable tasker, and
track task completion.

## Planned Features

-   **Accounts and profiles:** Registration, login, and management of
    user information, skills, interests, service area, and availability.
-   **Task request management:** Drafting and publishing requests,
    permitted editing, categorization, and entry of descriptions,
    budgets, estimated duration, approximate location, and completion
    criteria.
-   **Offer marketplace:** Browsing and filtering task requests,
    submitting and editing offers, and comparing taskers' proposed
    prices and schedules.
-   **Task assignment and tracking:** Atomic offer selection, recording
    task start and outcome, submitting evidence, and maintaining a
    status history.
-   **Simulated escrow wallet:** Recording simulated balances and
    transactions, reserving funds, and releasing or refunding them
    according to task status. Real payments are not a confirmed MVP
    commitment.
-   **Complaints and dispute resolution:** Creating cases, submitting
    explanations and evidence, reviewing cases, recording decisions, and
    maintaining an auditable history.
-   **Reviews and administration:** Collecting feedback after actual
    task completion and supporting oversight of users, documents, and
    cases.
-   **Smart recommendation engine:** Explainable ranking based on
    factors such as category and interests, distance, availability,
    successful history, and semantic text similarity. Evaluation against
    a simple baseline is also a project goal.
-   **Reporting and monitoring:** Providing information to assess system
    performance and identify errors.

## Main User Roles

-   **Requester:** Creates a task request, reviews offers, and confirms
    completion.
-   **Tasker:** Browses suitable requests and submits offers to complete
    them. The ability to submit offers depends on tasker confirmation.
-   **Administrator / Dispute Reviewer:** Oversees the platform within
    defined permissions, reviews reported issues, and handles disputes.

One account may act as both a requester and a tasker. Administrator or
dispute-reviewer privileges must not be granted through public
registration; assignment of these privileges must be controlled and
secure.

## MVP Scope and Important Rules

-   The estimated duration of each micro-task must be between **1 and
    300 minutes**.
-   The tasker's fee is separate from the cost of goods or supplies.
    Item costs may only be considered within an agreed limit and with
    supporting evidence.
-   Submitting an offer does not, by itself, create an obligation to
    perform the task. Assignment takes place after an offer is selected
    and the simulated escrow funding succeeds.
-   Each task may have only one active selected tasker.
-   Work must not begin before escrow funds have been successfully
    reserved.
-   Financial operations must be traceable and safe against duplicate
    requests. Sensitive operations should use unique identifiers and a
    transaction ledger.
-   If a dispute exists, the disputed funds must not be released
    automatically without a valid decision.
-   The exact task address must not be publicly exposed before
    assignment.
-   The MVP uses synthetic data and documents. Real identity information
    or operational secrets must not be stored or published without
    authorization and appropriate security controls.

### Out of Scope for the First Release

Real payments and bank withdrawals, a native mobile application,
nationwide coverage, 24/7 support, and a data-intensive machine-learning
recommendation engine are not confirmed commitments for the first
release. High-risk or regulated services, unsupervised care of children,
older adults, or patients, medical services, prohibited or controlled
items, and unauthorized access to private locations are also outside the
MVP scope.

## Technology Stack and Technical Decisions

The team has selected **Next.js** for the frontend and **Django** for
the backend. Other technical choices remain undecided until the team
agrees on them and documents the decision.

  Area                         Technology / Status
  ---------------------------- ---------------------
  Frontend                     **Next.js**
  Backend                      **Django**
  API framework / API design   To be decided
  Database                     To be decided
  Testing and deployment       To be decided
  Cache / queue / storage      To be decided
  Maps / notifications         To be decided

The software requirements specification (FS) lists options such as
TypeScript, Django REST Framework, PostgreSQL and PostGIS, Redis,
RabbitMQ, a separate recommendation module, Docker Compose, and GitHub
Actions. Apart from Next.js and Django, which have been selected, these
options require team agreement before they are treated as final
decisions.

## Architecture and Repository Structure

The frontend and backend are maintained in the **same repository
(monorepo)**. The following is the planned initial top-level structure;
it describes the intended layout and does not claim that every directory
has already been created.

``` text
vaka-platform/
├── frontend/       # Next.js
├── backend/        # Django
├── docs/           # Architecture, ERD, API, and strategy documentation
│   └── strategy.md  # Branching, commits, PRs, issues, testing, and 
├── .gitignore
└── README.md
```

The internal structure of each application, testing tools, and setup
files will be completed after the Next.js and Django projects are
created and the remaining technical decisions are finalized.

As development progresses, the repository is expected to include the
following engineering documentation:

-   Software architecture documentation and C4 diagrams;
-   An ERD, including relationships, primary keys, and foreign keys;
-   Sequence diagrams for key flows;
-   API documentation;
-   Test execution instructions and coverage reports;
-   Setup and deployment guides.

> Actual paths and files will be documented after the structure is
> approved and the files are created. Listing a document here does not
> mean it is already complete.

## Security and Privacy

-   Access to data and operations must be enforced on the server
    according to each user's role and permissions.
-   Secrets---including passwords, API keys, tokens, database
    credentials, and real environment-variable values---must never be
    committed to Git.
-   Real environment files must remain outside the repository. If
    needed, provide only safe templates such as `.env.example`, without
    secret values.
-   Access to records must be checked against ownership and permissions.
    Changing an ID or URL must not grant access to another user's data.
-   Location data and sensitive evidence must be minimized and
    accessible only within authorized boundaries.
-   Logs must not expose passwords, tokens, or sensitive data.

## Development Workflow

The project follows a consistent workflow for branches, commits, Pull
Requests, code reviews, task tracking, testing, and deployment.

See **[Development Strategy](docs/strategy.md)** for the complete team
rules and procedures. All contributors should follow this guide when
making changes to the repository.

## Team Members

The list below is based on the names in the software requirements
specification and the GitHub usernames provided for repository
invitations. Specific responsibilities will be assigned through project
tasks and Issues.

  ------------------------------------------------------------------------------------------------------
  Name          GitHub Username                                                         Responsibility
  ------------- ----------------------------------------------------------------------- ----------------
  Maryam Mohammadi      [MaryamM84](https://github.com/MaryamM84)                               To be assigned
                                                                             

  Setayesh Baghaei     [setayeshbaghaee](https://github.com/setayeshbaghaee)                   To be assigned
                                                                                 

  Melika Pahlevani    [melikapahlevani](https://github.com/melikapahlevani)                   To be assigned
                                                                               

  Fatemeh Abdollahi      [fatemehabdullahi](https://github.com/fatemehabdullahi)                 To be assigned
                                                                               
  Yasamin Zahra Javadzadeh [yasaminzahra-javadzadeh](https://github.com/yasaminzahra-javadzadeh)   To be assigned                                                                         

  Fatemeh Mohammadi     [FatemehM84](https://github.com/FatemehM84)                             To be assigned
                                                                             

  Hossein Majidi      [it-hosein](https://github.com/it-hosein)                               To be assigned
             

----------------------------------------------------------------------------------------------------

## Contributing

Before starting work, record the task in the project-management system,
identify its owner and acceptance criteria, and create a dedicated
branch. Use meaningful commits and submit changes through a Pull Request
with a clear description and testing evidence for review.

## License

The project's license has not yet been selected. The team will decide on
the license after reviewing the university's requirements.
