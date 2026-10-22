from flask_appbuilder.security.sqla.models import User
from sqlalchemy import Column, DateTime, Integer, String


class UserCustom(User):
    __table_args__ = None

    dept = Column(String(200))
    expire_date = Column(DateTime)
    person_contact = Column(String(200))
    mobile_phone = Column(String(20))
    home_dash_id = Column(Integer)
    agree_time = Column(DateTime)
    agree_ip = Column(String(60))


# The deployed PostgreSQL schema keeps the historical VARCHAR(64) email
# column. FAB 4.5 widens this column to 320 in its model by default.
UserCustom.__table__.c.email.type = String(64)
