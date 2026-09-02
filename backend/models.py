from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .clock import now
from .db import Base

task_commitments = Table("task_commitments", Base.metadata,
    Column("task_id", ForeignKey("tasks.id"), primary_key=True), Column("commitment_id", ForeignKey("commitments.id"), primary_key=True))
task_contacts = Table("task_contacts", Base.metadata,
    Column("task_id", ForeignKey("tasks.id"), primary_key=True), Column("contact_id", ForeignKey("contacts.id"), primary_key=True))
task_notes = Table("task_notes", Base.metadata,
    Column("task_id", ForeignKey("tasks.id"), primary_key=True), Column("note_id", ForeignKey("notes.id"), primary_key=True))
commitment_contacts = Table("commitment_contacts", Base.metadata,
    Column("commitment_id", ForeignKey("commitments.id"), primary_key=True), Column("contact_id", ForeignKey("contacts.id"), primary_key=True))
contact_notes = Table("contact_notes", Base.metadata,
    Column("contact_id", ForeignKey("contacts.id"), primary_key=True), Column("note_id", ForeignKey("notes.id"), primary_key=True))

class Timestamped:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now, nullable=False)

class Task(Timestamped, Base):
    __tablename__ = "tasks"; id: Mapped[int] = mapped_column(primary_key=True); title: Mapped[str] = mapped_column(String(200)); description: Mapped[str] = mapped_column(Text, default=""); priority: Mapped[str] = mapped_column(String(10), default="medium"); due_at: Mapped[Optional[datetime]] = mapped_column(DateTime); status: Mapped[str] = mapped_column(String(12), default="open"); completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime); recurrence: Mapped[str] = mapped_column(String(10), default="none"); recurrence_until: Mapped[Optional[datetime]] = mapped_column(DateTime); source_task_id: Mapped[Optional[int]] = mapped_column(ForeignKey("tasks.id")); is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    commitments = relationship("Commitment", secondary=task_commitments, back_populates="tasks"); contacts = relationship("Contact", secondary=task_contacts, back_populates="tasks"); notes = relationship("Note", secondary=task_notes, back_populates="tasks")
    __table_args__ = (CheckConstraint("priority in ('low','medium','high')"), CheckConstraint("status in ('open','completed')"), CheckConstraint("recurrence in ('none','daily','weekly','monthly')"))
class Commitment(Timestamped, Base):
    __tablename__ = "commitments"; id: Mapped[int] = mapped_column(primary_key=True); title: Mapped[str] = mapped_column(String(200)); kind: Mapped[str] = mapped_column(String(12), default="other"); starts_at: Mapped[datetime] = mapped_column(DateTime); duration_minutes: Mapped[Optional[int]] = mapped_column(Integer); location: Mapped[str] = mapped_column(String(200), default=""); attendees: Mapped[str] = mapped_column(String(500), default=""); notes: Mapped[str] = mapped_column(Text, default=""); status: Mapped[str] = mapped_column(String(12), default="scheduled"); is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    tasks = relationship("Task", secondary=task_commitments, back_populates="commitments"); contacts = relationship("Contact", secondary=commitment_contacts, back_populates="commitments"); meeting_notes = relationship("Note", back_populates="commitment")
    __table_args__ = (CheckConstraint("kind in ('meeting','other')"), CheckConstraint("status in ('scheduled','cancelled','completed')"), CheckConstraint("duration_minutes is null or duration_minutes > 0"))
class Contact(Timestamped, Base):
    __tablename__ = "contacts"; id: Mapped[int] = mapped_column(primary_key=True); name: Mapped[str] = mapped_column(String(160)); email: Mapped[str] = mapped_column(String(200), default=""); phone: Mapped[str] = mapped_column(String(60), default=""); organization: Mapped[str] = mapped_column(String(160), default=""); role: Mapped[str] = mapped_column(String(160), default=""); relationship_context: Mapped[str] = mapped_column(Text, default=""); is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    tasks = relationship("Task", secondary=task_contacts, back_populates="contacts"); commitments = relationship("Commitment", secondary=commitment_contacts, back_populates="contacts"); notes = relationship("Note", secondary=contact_notes, back_populates="contacts")
class Note(Timestamped, Base):
    __tablename__ = "notes"; id: Mapped[int] = mapped_column(primary_key=True); title: Mapped[str] = mapped_column(String(200), default=""); content: Mapped[str] = mapped_column(Text); kind: Mapped[str] = mapped_column(String(16), default="general"); commitment_id: Mapped[Optional[int]] = mapped_column(ForeignKey("commitments.id")); is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    commitment = relationship("Commitment", back_populates="meeting_notes"); tasks = relationship("Task", secondary=task_notes, back_populates="notes"); contacts = relationship("Contact", secondary=contact_notes, back_populates="notes")
    __table_args__ = (CheckConstraint("kind in ('general','preparation','follow_up')"),)
class Reminder(Timestamped, Base):
    __tablename__ = "reminders"; id: Mapped[int] = mapped_column(primary_key=True); title: Mapped[str] = mapped_column(String(200)); remind_at: Mapped[datetime] = mapped_column(DateTime); status: Mapped[str] = mapped_column(String(16), default="upcoming"); task_id: Mapped[Optional[int]] = mapped_column(ForeignKey("tasks.id")); commitment_id: Mapped[Optional[int]] = mapped_column(ForeignKey("commitments.id")); is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    __table_args__ = (CheckConstraint("status in ('upcoming','acknowledged','snoozed','dismissed')"), CheckConstraint("not (task_id is not null and commitment_id is not null)"))
class InboxItem(Timestamped, Base):
    __tablename__ = "inbox_items"; id: Mapped[int] = mapped_column(primary_key=True); content: Mapped[str] = mapped_column(Text); status: Mapped[str] = mapped_column(String(12), default="pending"); processed_type: Mapped[Optional[str]] = mapped_column(String(12)); processed_id: Mapped[Optional[int]] = mapped_column(Integer); is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    __table_args__ = (CheckConstraint("status in ('pending','processed','dismissed')"), CheckConstraint("processed_type is null or processed_type in ('task','note','reminder')"))
