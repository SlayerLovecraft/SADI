path = '_react_legacy/SADI_React-Node.js/src/contexts/AuthContext.jsx'
with open(path, 'rb') as f:
    raw = f.read()

# Replace in raw bytes to handle CRLF seamlessly
old_bytes = b"if (parsedUser.role === 'patient' || parsedUser.role === 'doctor') {"
new_bytes = b"if (parsedUser.role === 'patient' || parsedUser.role === 'doctor' || parsedUser.role === 'hospital_admin' || parsedUser.role === 'super_admin' || parsedUser.role === 'operator') {"

if old_bytes in raw:
    raw = raw.replace(old_bytes, new_bytes)
    with open(path, 'wb') as f:
        f.write(raw)
    print("SUCCESS: AuthContext patched!")
else:
    print("WARNING: old_bytes not found in AuthContext.jsx")
