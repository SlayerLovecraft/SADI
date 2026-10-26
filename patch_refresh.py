path = '_react_legacy/SADI_React-Node.js/src/contexts/AuthContext.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

target = "if (user.role === 'patient' || user.role === 'doctor') return;"
replacement = "if (user.role === 'patient' || user.role === 'doctor' || user.role === 'hospital_admin' || user.role === 'super_admin' || user.role === 'operator') return;"

if target in text:
    text = text.replace(target, replacement)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    print("SUCCESS: Line 101 refresh check patched!")
else:
    print("WARNING: Target line 101 not found!")
