from datetime import datetime, time, timedelta
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..clock import now, today
from ..models import Commitment, InboxItem, Reminder, Task
def context(session: Session):
    current=now(); start=datetime.combine(today(), time.min); end=start+timedelta(days=1); horizon=current+timedelta(days=7)
    return {"today": today(), "priority_tasks": session.scalars(select(Task).where(Task.status=="open", Task.priority=="high", Task.due_at >= start, Task.due_at < end).order_by(Task.due_at)).all(), "overdue_tasks": session.scalars(select(Task).where(Task.status=="open", Task.due_at < current).order_by(Task.due_at)).all(), "commitments": session.scalars(select(Commitment).where(Commitment.starts_at >= current, Commitment.starts_at <= horizon, Commitment.status=="scheduled").order_by(Commitment.starts_at)).all(), "inbox_count": len(session.scalars(select(InboxItem).where(InboxItem.status=="pending")).all()), "reminders": session.scalars(select(Reminder).where(Reminder.status.in_(["upcoming", "snoozed"])).order_by(Reminder.remind_at)).all()}
