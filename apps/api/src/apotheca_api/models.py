import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apotheca_api.database import Base


def _uuid_str() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_admin: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    lots: Mapped[list["Lot"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    password_reset_tokens: Mapped[list["PasswordResetToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class ActiveIngredient(Base):
    __tablename__ = "active_ingredients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    name: Mapped[str] = mapped_column(String(500), unique=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    medications: Mapped[list["Medication"]] = relationship(back_populates="active_ingredient")


class Presentation(Base):
    __tablename__ = "presentations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    medications: Mapped[list["Medication"]] = relationship(back_populates="presentation")


class Medication(Base):
    __tablename__ = "medications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    national_code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(500), index=True, nullable=False)
    barcode: Mapped[str | None] = mapped_column(String(50), index=True, nullable=True)
    laboratory: Mapped[str | None] = mapped_column(String(255), nullable=True)
    dosage: Mapped[str | None] = mapped_column(String(100), nullable=True)
    prescription: Mapped[bool] = mapped_column(default=False)
    CIMA_data: Mapped[str | None] = mapped_column(Text, nullable=True)

    active_ingredient_id: Mapped[str] = mapped_column(ForeignKey("active_ingredients.id"), nullable=False)
    presentation_id: Mapped[str] = mapped_column(ForeignKey("presentations.id"), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    active_ingredient: Mapped["ActiveIngredient"] = relationship(back_populates="medications")
    presentation: Mapped["Presentation"] = relationship(back_populates="medications")
    lots: Mapped[list["Lot"]] = relationship(back_populates="medication", cascade="all, delete-orphan")

    @property
    def active_ingredient_name(self) -> str | None:
        return self.active_ingredient.name if self.active_ingredient else None

    @property
    def presentation_name(self) -> str | None:
        return self.presentation.name if self.presentation else None


class Lot(Base):
    __tablename__ = "lots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    medication_id: Mapped[str] = mapped_column(ForeignKey("medications.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expiry_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    daily_dose: Mapped[float | None] = mapped_column(Float, nullable=True)
    treatment_days: Mapped[float | None] = mapped_column(Float, nullable=True)
    dose_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    acquired_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    medication: Mapped["Medication"] = relationship(back_populates="lots")
    user: Mapped["User"] = relationship(back_populates="lots")

    @property
    def effective_quantity(self) -> float:
        eff, _, _ = compute_dose_consumption(
            self.quantity, self.daily_dose, self.treatment_days, self.dose_start_date
        )
        return round(eff, 1)


def compute_dose_consumption(
    quantity: int | float,
    daily_dose: float | None,
    treatment_days: float | None,
    dose_start_date: date | None,
    now: date | None = None,
) -> tuple[float, float | None, bool]:
    """Calculate remaining stock after daily-dose consumption.

    Returns (effective_quantity, days_until_depleted, is_actively_consuming).
    The discount is virtual: it is computed on read and never mutates ``quantity``.
    """
    if not daily_dose or daily_dose <= 0 or not dose_start_date:
        return float(quantity), None, False

    today = now or datetime.now(timezone.utc).date()
    if dose_start_date > today:
        return float(quantity), None, False

    elapsed_days = (today - dose_start_date).days
    if treatment_days is not None and treatment_days >= 0:
        consuming_days = min(float(elapsed_days), treatment_days)
        treatment_finished = elapsed_days >= treatment_days
    else:
        consuming_days = float(elapsed_days)
        treatment_finished = False

    consumed = daily_dose * max(consuming_days, 0.0)
    effective = max(0.0, float(quantity) - consumed)

    if treatment_finished:
        return effective, (0.0 if effective <= 0 else None), False

    days_left = effective / daily_dose if daily_dose > 0 else None
    return effective, days_left, True


class Settings(Base):
    __tablename__ = "settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    key: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    lot_id: Mapped[str | None] = mapped_column(ForeignKey("lots.id"), nullable=True)
    notification_type: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    status: Mapped[str] = mapped_column(String(20), default="sent")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User | None"] = relationship(back_populates="audit_logs")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="password_reset_tokens")
