import smtplib
import ssl
from email.message import EmailMessage

from app.config import get_settings
from app.errors import DomainError


def send_reset_code(email: str, otp: str):
    settings = get_settings()
    if not settings.smtp_host:
        raise DomainError(503, "MAIL_UNAVAILABLE", "Password reset delivery is not configured")
    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = email
    message["Subject"] = "StockSense password reset"
    message.set_content(f"Your StockSense reset code is {otp}. It expires in 10 minutes.")
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as client:
            if settings.smtp_starttls:
                client.starttls(context=ssl.create_default_context())
            if settings.smtp_username:
                client.login(settings.smtp_username, settings.smtp_password.get_secret_value())
            client.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise DomainError(503, "MAIL_UNAVAILABLE", "Password reset delivery unavailable") from exc
