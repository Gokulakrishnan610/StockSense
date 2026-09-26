from app.celery_app import celery_app
from app.services import mailer

@celery_app.task(name="app.tasks.send_reset_code")
def send_reset_code_task(email: str, otp: str):
    mailer.send_reset_code(email, otp)

@celery_app.task(name="app.tasks.send_welcome_email")
def send_welcome_email_task(email: str, name: str):
    mailer.send_welcome_email(email, name)

@celery_app.task(name="app.tasks.send_low_stock_alert")
def send_low_stock_alert_task(email: str, product_name: str, sku: str, current_stock: str, min_stock: str):
    mailer.send_low_stock_alert(email, product_name, sku, current_stock, min_stock)
