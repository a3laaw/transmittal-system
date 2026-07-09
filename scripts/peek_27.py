import openpyxl
wb = openpyxl.load_workbook('/home/z/my-project/upload/TRANSIMITALS.xlsx', data_only=True)

for sn in ['27-R01', '27-R02']:
    print('=' * 100)
    print('SHEET:', sn)
    print('=' * 100)
    ws = wb[sn]
    for r in range(14, 30):
        row_vals = []
        for c in range(1, 10):
            v = ws.cell(row=r, column=c).value
            if v is None:
                row_vals.append('')
            else:
                row_vals.append(str(v).replace('\n', ' / '))
        print(f"R{r:02d}: " + ' | '.join(row_vals))
    print()
