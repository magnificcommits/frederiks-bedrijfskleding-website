import io
def lees(p): return io.open(p, encoding='utf-8', newline='').read()
def schrijf(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)
def verv(s, oud, nieuw, alles=False):
    for o, n in ((oud, nieuw), (oud.replace('\n', '\r\n'), nieuw.replace('\n', '\r\n'))):
        if o in s:
            return s.replace(o, n) if alles else s.replace(o, n, 1)
    print('   ! niet gevonden:', oud.strip().split('\n')[0][:80]); return s
