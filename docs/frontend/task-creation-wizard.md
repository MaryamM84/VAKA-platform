# VAKA Task Creation Wizard — Implementation Documentation

> **Document status:** Completed implementation handover  
> **Scope covered:** Five-step task creation wizard, UI/UX refinements, form validation, Persian date/time handling, and backend draft-creation integration  
> **Main code path:** `frontend/src/components/task-creation/`  
> **API helpers:** `frontend/src/lib/task-api.ts`, `frontend/src/lib/task-payload.ts`

---

## 1. Purpose and Scope

The VAKA Task Creation Wizard is a five-step frontend workflow that enables employers to define, schedule, configure, and review tasks before saving them as drafts.

This document describes the completed frontend implementation, including the shared form architecture, all five wizard steps, Persian date/time handling, location selection, budget calculations, validation, navigation behavior, and the task draft-creation integration.

The implementation focuses on providing a consistent, responsive, and user-friendly task creation experience while maintaining compatibility with the backend API structure.

### Implementation Overview

| Area | Implementation Status |
|---|---|
| Five-step wizard UI | Implemented |
| Shared form state | Implemented |
| Step 1 — Task details | Implemented |
| Step 2 — Scheduling and urgency | Implemented |
| Step 3 — Location selection | Implemented |
| Step 4 — Budget and costs | Implemented |
| Step 5 — Review | Implemented |
| Persian numeral display and normalization | Implemented |
| Persian date/time input and conversion | Implemented |
| Required-field validation | Implemented |
| Origin/destination validation | Implemented |
| Map navigation and scrolling | Implemented |
| API request helper | Implemented |
| Task creation payload mapping | Implemented |
| JWT authentication handling | Implemented |
| Draft creation request | Implemented |
| Success and error feedback | Implemented |

---

## 2. File Structure

The Task Creation Wizard is implemented through the following frontend files:

| File | Responsibility |
|---|---|
| `src/components/task-creation/TaskCreationWizard.tsx` | Parent wizard component, shared state management, step navigation, validation, and draft submission |
| `src/components/task-creation/types.ts` | Defines `TaskFormData` and `initialTaskFormData` |
| `src/components/task-creation/steps/Step1Details.tsx` | Task title, category, description, and delivery criteria |
| `src/components/task-creation/steps/Step2Schedule.tsx` | Estimated duration, proposal deadline, execution schedule, deadline, and urgency |
| `src/components/task-creation/steps/PersianDateTimeField.tsx` | Reusable Persian date/time input component |
| `src/components/task-creation/steps/Step3Location.tsx` | Location modes, map interaction, coordinates, address, and location details |
| `src/components/task-creation/steps/Step4Budget.tsx` | Wage budget, goods purchase, item cost cap, and receipt requirements |
| `src/components/task-creation/steps/Step5Review.tsx` | Final task summary, editing navigation, and draft-saving action |
| `src/lib/auth-api.ts` | Existing authentication and access-token helper |
| `src/lib/task-api.ts` | API configuration, authenticated requests, category retrieval, and task draft creation |
| `src/lib/task-payload.ts` | Converts frontend form data into the backend task creation payload |

---

## 3. Wizard Architecture and Shared State

`TaskCreationWizard.tsx` is the parent component responsible for coordinating the five steps.

The wizard consists of:

1. Task details
2. Schedule and urgency
3. Location
4. Budget and costs
5. Review and draft creation

### Shared State Management

The parent component maintains:

- `currentStep`: Current wizard step.
- `formData`: Shared task information.
- `validationErrors`: Validation messages.
- `isSavingDraft`: Draft submission loading state.
- `submitError`: Submission error feedback.
- `submitMessage`: Successful submission feedback.

Each step receives the current form values through its `data` prop and updates the shared state through the parent callback.

This architecture ensures that entered information remains available when users navigate between steps.

Form data is maintained in React state during the current page session. Persistent draft data is handled through the backend draft-creation request.

### Navigation and Validation

The wizard provides:

- Previous and Next navigation.
- Stepper and progress indicator.
- Step-specific validation.
- Navigation from the review page to earlier steps.
- Scroll adjustment when moving between steps.

Users cannot proceed when applicable required fields are missing or invalid.

---

## 4. Shared Form Data

The `TaskFormData` interface in `types.ts` defines the information collected throughout the wizard.

### Step 1 — Task Details

- `title`
- `categoryId`
- `categoryName`
- `description`
- `deliveryCriteria`

The category identifier is maintained separately from its display name to support backend category references.

### Step 2 — Scheduling

- `estimatedDurationMinutes`
- `proposalDeadlineAt`
- `executionWindowEndAt`
- `executionStartTime`
- `deadlineAt`
- `urgency`

### Step 3 — Location

- `locationMode`
- `locationLatitude`
- `locationLongitude`
- `locationAddress`
- `originLatitude`
- `originLongitude`
- `originAddress`
- `destinationLatitude`
- `destinationLongitude`
- `destinationAddress`
- `locationBuilding`
- `locationUnit`
- `locationDeliveryNotes`
- `locationRadiusMeters`

These fields support both fixed-location and origin/destination task modes.

### Step 4 — Budget

- `wageBudgetAmount`
- `currencyCode`
- `itemCostCapAmount`
- `goodsPurchaseRequired`
- `invoiceRequired`

Initial values are defined through `initialTaskFormData`.

---

## 5. Step-by-Step Implementation

### Step 1 — Task Details

**File:** `steps/Step1Details.tsx`

This step collects the basic information required to describe a task:

- Task title
- Category
- Description
- Delivery criteria

The category selection interface provides the available category choices in the form.

The selected category identifier is stored in `categoryId`, while `categoryName` is used for display purposes.

The step includes required-field validation to ensure that the main task information is provided before proceeding.

### Step 2 — Schedule and Urgency

**File:** `steps/Step2Schedule.tsx`

This step collects scheduling information:

- Estimated duration
- Proposal deadline
- Execution start time
- Execution window end
- Task deadline
- Urgency

The reusable `PersianDateTimeField.tsx` component provides the Persian date/time input experience.

The duration input supports manual entry and UI-based selection, with a maximum allowed value of **300 minutes**.

Persian and Arabic-Indic digits are normalized when numeric values are processed.

Date/time values are converted into machine-readable ISO 8601 timestamps when constructing the backend request.

### Step 3 — Location

**File:** `steps/Step3Location.tsx`

The location step supports two modes:

- Fixed location
- Origin and destination

Implemented capabilities include:

- Map-based location selection
- Latitude and longitude handling
- Address information
- Location radius
- Building and unit details
- Delivery and access notes

In origin/destination mode, both locations are required before proceeding.

The Select on Map action navigates the user to the map section so that location selection can be completed conveniently.

The map selection behavior is integrated into the step without requiring changes to the global stylesheet.

### Step 4 — Budget and Costs

**File:** `steps/Step4Budget.tsx`

This step collects the financial information associated with the task:

- Wage budget
- Currency code
- Item/goods cost cap
- Goods purchase requirement
- Receipt/invoice requirement

The component supports Persian numeral formatting and normalization.

The budget summary calculates the total estimated cost using the wage budget and, when goods purchase is enabled, the item cost cap.

The purchase and receipt selections are maintained as form values and mapped to the corresponding backend fields during payload construction.

### Step 5 — Review

**File:** `steps/Step5Review.tsx`

The review step presents a summary of the information entered in the previous steps.

It includes:

- Task details
- Scheduling information
- Location details
- Budget information
- Navigation back to earlier steps for editing

The review component uses the shared `formData` supplied by the parent wizard.

The final actions include draft saving and the separate task publication action.

The draft-saving button is connected to the parent submission handler and displays a loading state while the request is being processed.

Success and error messages are displayed within the review interface.

---

## 6. Persian Numerals, Date/Time, and RTL Behavior

The task creation interface includes several refinements for Persian-language usability.

Implemented behavior includes:

- Persian numeral display using `۰۱۲۳۴۵۶۷۸۹`.
- Normalization of Persian and Arabic-Indic digits for numeric processing.
- Appropriate alignment of numeric inputs.
- RTL-compatible date/time field layout.
- Correct placement of calendar icons.
- Persian calendar date selection.
- Conversion of date/time values into machine-readable timestamps.

Persian calendar components are handled separately from Gregorian date components to prevent incorrect date interpretation.

API-facing numeric and date/time values are converted into the expected machine-readable representation instead of sending localized display strings.

---

## 7. Validation and UX Refinements

The following frontend review topics have been addressed during implementation.

| # | Review topic | Implementation |
|---|---|---|
| 1 | Color consistency | Existing CSS design tokens are reused across the reviewed components. |
| 2 | Persian numerals | Persian numeral display and digit normalization are implemented. |
| 3 | Required-field validation | Required-field checks are integrated into the wizard flow. |
| 4 | Origin/destination validation | Both origin and destination are required in the corresponding location mode. |
| 5 | Step navigation and scrolling | Navigation adjusts the viewport to the beginning of the new step. |
| 6 | Map navigation | Select on Map navigates to the map section. |
| 7 | Maximum duration | The 300-minute limit applies to manual input and UI selection. |
| 8 | RTL input and icon alignment | Numeric alignment and date/calendar icon placement are adjusted for RTL. |

The implementation reuses existing design tokens and avoids unnecessary modifications to `src/app/globals.css`.

---

## 8. Styling and Design-System Constraints

The wizard follows the existing VAKA frontend design system.

Implementation guidelines include:

- Reuse CSS variables and design tokens from `src/app/globals.css`.
- Avoid introducing unnecessary hardcoded colors.
- Preserve RTL layout behavior.
- Maintain responsive layouts across screen sizes.
- Prefer component-level styling for local adjustments.
- Preserve map behavior when modifying surrounding UI components.

---

## 9. Backend API Integration

The task creation flow includes an API integration layer that separates request handling from UI components.

### API Helper

**File:** `src/lib/task-api.ts`

The API helper provides:

- Backend base URL configuration through `NEXT_PUBLIC_API_BASE_URL`.
- Authenticated HTTP requests.
- JSON request and response handling.
- Access-token retrieval through the existing authentication helper.
- API error handling and user-friendly error messages.
- Task category retrieval.
- Task draft creation.

### Task Category Retrieval

The category retrieval function is:

`getTaskCategories()`

It sends a GET request to:

`/api/task-categories/`

The returned category data is represented through the `TaskCategory` interface.

The interface includes:

- `category_id`
- `name`
- `description`
- `parent_category_id`
- `parent_category_name`

### Task Draft Creation

The draft creation function is:

`createTaskDraft(payload)`

It sends an authenticated POST request to:

`/api/tasks/`

The request uses JSON content and the Bearer token authentication scheme.

### Payload Mapping

**File:** `src/lib/task-payload.ts`

The `buildTaskCreatePayload()` function converts the frontend `TaskFormData` into the backend request structure.

The mapping includes:

| Frontend field | Backend field |
|---|---|
| `categoryId` | `category_id` |
| `title` | `title` |
| `description` | `description` |
| `deliveryCriteria` | `delivery_criteria` |
| `estimatedDurationMinutes` | `estimated_duration_minutes` |
| `wageBudgetAmount` | `wage_budget_amount` |
| `itemCostCapAmount` | `item_cost_cap_amount` |
| `invoiceRequired` | `receipt_required` |
| `executionStartTime` | `execution_window_start_at` |
| `executionWindowEndAt` | `execution_window_end_at` |
| `proposalDeadlineAt` | `proposal_deadline_at` |
| `deadlineAt` | `deadline_at` |

Numeric values are normalized before conversion.

Date/time values are converted to ISO 8601 timestamps.

Optional values are represented as `null` where applicable.

Location fields are currently maintained by the frontend form and are not included in the draft-creation payload.

### Draft Submission Flow

The draft-saving process follows this sequence:

1. The user completes the five-step wizard.
2. The review screen displays the entered information.
3. The user selects Save as Draft.
4. `handleSaveDraft()` is called in `TaskCreationWizard.tsx`.
5. `buildTaskCreatePayload()` constructs the API request body.
6. `createTaskDraft()` sends the POST request.
7. The API response is processed.
8. The review screen displays the corresponding success or error message.

The submission button displays a loading state while the request is in progress.

The returned task identifier is included in the success message.

### Environment Configuration

The backend base URL is configured through the frontend environment file:

`.env.local`

Example:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

The URL should match the backend environment used for development.

---

## 10. Error Handling and User Feedback

The API helper handles common request failures and converts them into readable messages.

Supported cases include:

| HTTP status | User-facing behavior |
|---|---|
| 400 | Invalid or incomplete request data |
| 401 | Authentication session expired or missing |
| 403 | User does not have permission to create tasks |
| 404 | API endpoint not found |
| 500 and above | Server-side error |
| Network failure | Connection error message |

The review page displays success and error feedback.

The draft-saving button is disabled while the request is being processed to prevent repeated submissions.

---

## 11. Testing and Verification

The following development checks have been used during implementation.

### TypeScript Check

Command:

```bash
npx tsc --noEmit
```

The latest reported execution completed without TypeScript errors.

### Production Build

Command:

```bash
npm run build
```

Production builds were successfully completed during the earlier frontend refinement work.

### Development Server

The task creation route was previously accessed successfully through the Next.js development server:

`/employer/tasks/create`

The reported response was:

```text
GET /employer/tasks/create 200
```

### Git Diff Check

Command:

```bash
git diff --check
```

The reported execution completed without whitespace errors.

---

## 12. Known Implementation Notes

- Shared form data is maintained in React state during the active page session.
- The category identifier is maintained separately from the category display name.
- The location interface supports fixed-location and origin/destination modes.
- Location data is not currently included in the draft-creation payload.
- The publication action is separate from draft saving.
- The existing Persian date/time and numeral handling should be preserved when extending the wizard.
- The API base URL is environment-configurable and should not be hardcoded in application components.

---

## 13. Git and Handover Notes

The Task Creation Wizard implementation is maintained within the VAKA platform frontend repository.

Repository:

`https://github.com/MaryamM84/VAKA-platform`

Main implementation directory:

`frontend/src/components/task-creation/`

API helper directory:

`frontend/src/lib/`

The implementation is organized so that UI components, shared form state, request handling, and payload mapping remain separate.

When extending the wizard, preserve the existing component responsibilities and shared-state architecture.

---

## 14. Final Status

**Overall status: Five-step Task Creation Wizard implemented, refined, and integrated with the task draft-creation API layer.**

The completed implementation includes:

- Five-step task creation workflow.
- Shared form state and navigation.
- Task details and scheduling.
- Location selection and map interaction.
- Budget and cost calculations.
- Final review interface.
- Persian numeral and date/time handling.
- Validation and RTL refinements.
- API request and payload-mapping helpers.
- JWT-based request authentication.
- Draft creation submission flow.
- Success and error feedback.

The implementation provides a structured foundation for the VAKA task creation workflow and supports further development of task publication, category loading, and additional backend-connected functionality.