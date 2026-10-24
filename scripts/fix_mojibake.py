"""Repair UTF-8 mojibake produced by Windows PowerShell text round-trips."""

import sys

# cp1252 has five undefined slots; the original bytes are the values themselves.
UNDEFINED_CP1252 = {0x81: 0x81, 0x8D: 0x8D, 0x8F: 0x8F, 0x90: 0x90, 0x9D: 0x9D}


def reverse(path: str) -> bytes:
    data = open(path, 'rb').read()
    for prefix in (b'\xc3\xaf\xc2\xbb\xc2\xbf', b'\xef\xbb\xbf'):
        if data.startswith(prefix):
            data = data[len(prefix):]
            break
    out = bytearray()
    for char in data.decode('utf-8'):
        code = ord(char)
        if code < 128:
            out.append(code)
            continue
        try:
            out += char.encode('cp1252')
        except UnicodeEncodeError:
            out.append(UNDEFINED_CP1252.get(code, code))
    return bytes(out)


def main() -> None:
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else src
    repaired = reverse(src)
    open(dst, 'wb').write(repaired)
    print(f"{src} -> {dst}: {len(repaired)} bytes")


if __name__ == '__main__':
    main()
