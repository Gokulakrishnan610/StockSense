import smtplib
import ssl
from email.message import EmailMessage

from app.config import get_settings
from app.errors import DomainError


def _send_email(email: str, subject: str, html_content: str, text_content: str):
    settings = get_settings()
    if not settings.smtp_host:
        raise DomainError(503, "MAIL_UNAVAILABLE", "Email delivery is not configured")
    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = email
    message["Subject"] = subject
    message.set_content(text_content)
    message.add_alternative(html_content, subtype='html')
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as client:
            if settings.smtp_starttls:
                client.starttls(context=ssl.create_default_context())
            if settings.smtp_username:
                client.login(settings.smtp_username, settings.smtp_password.get_secret_value())
            client.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise DomainError(503, "MAIL_UNAVAILABLE", "Email delivery unavailable") from exc


def send_reset_code(email: str, otp: str):
    html = f"<html><body><h2>Password Reset</h2><p>Your StockSense reset code is <b>{otp}</b>.</p><p>It expires in 10 minutes.</p></body></html>"
    text = f"Your StockSense reset code is {otp}. It expires in 10 minutes."
    _send_email(email, "StockSense password reset", html, text)


def send_welcome_email(email: str, name: str):
    html = f"<html><body><h2>Welcome to StockSense, {name}!</h2><p>Your account has been created successfully.</p></body></html>"
    text = f"Welcome to StockSense, {name}! Your account has been created successfully."
    _send_email(email, "Welcome to StockSense", html, text)


def send_low_stock_alert(email: str, product_name: str, sku: str, current_stock: str, min_stock: str):
    html = f"<html><body><h2>Low Stock Alert</h2><p>The product <b>{product_name}</b> (SKU: {sku}) is low on stock.</p><p>Current stock: {current_stock}<br>Minimum stock limit: {min_stock}</p><p>Please reorder soon.</p></body></html>"
    text = f"Low Stock Alert: {product_name} (SKU: {sku}) is low on stock. Current: {current_stock}, Min: {min_stock}."
    _send_email(email, f"Low Stock Alert: {product_name}", html, text)
