# Browser POC behavior contract

The browser POC ports the local, single-user data behavior from `backend/`.
The UI calls semantic worker operations rather than reproducing HTTP routes.

| Source behavior | Browser operation | Rule retained |
| --- | --- | --- |
| Dashboard | `dashboard.get` | Local-day priorities, overdue tasks, seven-day commitments, active reminders |
| Lists/forms | `records.list`, `records.get`, `records.save` | Required fields, enum validation, associations, timestamps |
| Task completion/postponement | `records.action(tasks, …)` | Completion and one next recurrence occurrence |
| Commitments | `records.save(commitments, …)` | Positive duration and advisory overlap detection |
| Contact deletion | `records.action(contacts, delete)` | Refuse deletion while any relationship link exists |
| Inbox processing | `records.action(inbox_items, process)` | Create target and mark source processed in one transaction |
| Reminders | `records.action(reminders, …)` | Acknowledge, snooze, dismiss, and one linked target maximum |
| Search | `search` | Case-insensitive search across all six record types |
| Sample reset | `workspace.reset` | Replace only sample rows and their links; retain user-created rows |

The POC deliberately changes transport and rendering: HTTP POST/redirect/Jinja
are replaced by browser navigation, DOM rendering, worker RPC, and in-app
messages. It does not claim live compatibility with the existing unversioned
`assistant.db`; import accepts only the POC schema revision.
