import pymssql

conn = pymssql.connect(
    server='192.168.78.160',
    user='sa',
    password='Th@nfS@',
    database='tffy_center',
    tds_version='7.0',
)

cursor = conn.cursor()

cursor.execute("""
    SELECT top 5 品种, 会员简称,CAST(会员简称 AS NVARCHAR(100)) as 会员简称_N FROM 视图_量化_期货公司持仓盈亏
""")
row = cursor.fetchone()
print(row)
print('pymssql.version_info', pymssql.version_info)
print('pymssql.__file__', pymssql.__file__)
print('pymssql.get_freetds_version()', pymssql.get_freetds_version())

