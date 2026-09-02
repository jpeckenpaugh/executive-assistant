from datetime import timedelta
from sqlalchemy.orm import Session
from ..clock import now
from ..models import Task
def complete_task(session: Session, task: Task):
    if task.status == "completed": return
    task.status = "completed"; task.completed_at = now()
    if task.recurrence == "none": return
    days = {"daily": 1, "weekly": 7, "monthly": 30}[task.recurrence]
    due = (task.due_at or now()) + timedelta(days=days)
    if task.recurrence_until is None or due <= task.recurrence_until:
        session.add(Task(title=task.title, description=task.description, priority=task.priority, due_at=due, recurrence=task.recurrence, recurrence_until=task.recurrence_until, source_task_id=task.id))
