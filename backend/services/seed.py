from datetime import timedelta
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session
from ..clock import now
from ..models import Commitment, Contact, InboxItem, Note, Reminder, Task

def seed(session: Session, force=False):
    if not force and session.scalar(select(Task.id).limit(1)): return
    current = now(); jordan = Contact(name="Jordan Lee", email="jordan@example.com", organization="Northstar Labs", role="Partner", relationship_context="Primary project contact", is_sample=True)
    planning = Commitment(title="Product planning", kind="meeting", starts_at=current + timedelta(days=1), duration_minutes=45, location="Video call", attendees="Jordan Lee", is_sample=True)
    task = Task(title="Review weekly priorities", priority="high", due_at=current + timedelta(hours=3), is_sample=True)
    session.add_all([jordan, planning, task]); session.flush(); planning.contacts.append(jordan); task.contacts.append(jordan)
    session.add_all([Task(title="Send project recap", priority="medium", due_at=current + timedelta(days=1), recurrence="weekly", is_sample=True), Note(title="Planning agenda", content="Review milestones and risks.", kind="preparation", commitment=planning, is_sample=True), Reminder(title="Prepare planning agenda", remind_at=current + timedelta(hours=20), commitment_id=planning.id, is_sample=True), InboxItem(content="Ask Jordan about launch dates", is_sample=True)])
    session.commit()
def reset_samples(session: Session):
    # Remove only links touching a sample row; user-to-user links are retained.
    from ..models import contact_notes, commitment_contacts, task_notes, task_contacts, task_commitments
    sample_tasks=select(Task.id).where(Task.is_sample.is_(True)); sample_contacts=select(Contact.id).where(Contact.is_sample.is_(True)); sample_notes=select(Note.id).where(Note.is_sample.is_(True)); sample_commitments=select(Commitment.id).where(Commitment.is_sample.is_(True))
    session.execute(delete(contact_notes).where(or_(contact_notes.c.contact_id.in_(sample_contacts),contact_notes.c.note_id.in_(sample_notes))))
    session.execute(delete(commitment_contacts).where(or_(commitment_contacts.c.commitment_id.in_(sample_commitments),commitment_contacts.c.contact_id.in_(sample_contacts))))
    session.execute(delete(task_notes).where(or_(task_notes.c.task_id.in_(sample_tasks),task_notes.c.note_id.in_(sample_notes))))
    session.execute(delete(task_contacts).where(or_(task_contacts.c.task_id.in_(sample_tasks),task_contacts.c.contact_id.in_(sample_contacts))))
    session.execute(delete(task_commitments).where(or_(task_commitments.c.task_id.in_(sample_tasks),task_commitments.c.commitment_id.in_(sample_commitments))))
    for cls in (Reminder, Note, InboxItem, Commitment, Contact, Task): session.execute(delete(cls).where(cls.is_sample.is_(True)))
    session.commit(); seed(session, force=True)
