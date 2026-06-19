import sys

file_path = r'c:\Users\Mirley\Downloads\APP - PORGRAMACION\coraza-cta-app\src\pages\GestionPuestos.tsx'

with open(file_path, 'rb') as f:
    content = f.read()

# Replace "SISTEMA DE CONTROL TÃ CTICO" -> "SISTEMA DE CONTROL TÁCTICO"
# The TÃ CTICO sequence in UTF-8 is T\xc3\x83\x20CTICO ? 
# Let's search for the bytes.
# GESTIÃ“N -> GESTIÓN

# Actually, I'll just look for common mis-encodings of TÁCTICO and GESTIÓN
replacements = [
    (b'T\xc3\x83\x20CTICO', 'TÁCTICO'.encode('utf8')),
    (b'GESTI\xc3\x83\xe2\x80\x9cN', 'GESTIÓN'.encode('utf8')), # UTF-8 representation of GESTIÃ“N can be complex
    (b'GESTI\xc3\x93N', 'GESTIÓN'.encode('utf8')),
    (b'T\xc3\x81CTICO', 'TÁCTICO'.encode('utf8')),
]

# Another way: search for line 2051 and 2054 and just replace them entirely.
lines = content.splitlines()
if len(lines) >= 2054:
    # Line 2051 (index 2050)
    lines[2050] = b'              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">SISTEMA DE CONTROL T\xc3\x81CTICO</span>'
    # Line 2054 (index 2053)
    lines[2053] = b'              GESTI\xc3\x93N <span className="text-primary text-[28px] not-italic">DE</span> <span className="bg-gradient-to-r from-white to-slate-500 bg-clip-text text-transparent not-italic">PUESTOS</span>'

with open(file_path, 'wb') as f:
    f.write(b'\n'.join(lines))

print("Fixed header encoding")
