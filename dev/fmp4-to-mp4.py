"""Rewrite a fragmented MP4 (what Chrome's MediaRecorder makes: one empty moov, then moof+mdat pairs, duration 0)
as an ordinary MP4 with one sample table and a real duration, so QuickTime, phones and uploads show its length and
can seek. One video track only (dev/demo-encode.mjs records no audio). No dependencies.

    python3 dev/fmp4-to-mp4.py in.mp4 out.mp4
"""
import struct
import sys

CONTAINERS = {b'moov', b'trak', b'mdia', b'minf', b'stbl', b'mvex', b'moof', b'traf', b'dinf', b'edts'}


def boxes(b, off, end):
    """(type, start, header_size, size) of each box in b[off:end]"""
    out = []
    while off + 8 <= end:
        size, typ = struct.unpack('>I4s', b[off:off + 8]); hs = 8
        if size == 1: size = struct.unpack('>Q', b[off + 8:off + 16])[0]; hs = 16
        if size == 0: size = end - off
        out.append((typ, off, hs, size)); off += size
    return out


def child(b, box, typ):
    t, off, hs, size = box
    for c in boxes(b, off + hs, off + size):
        if c[0] == typ: return c
    return None


def path(b, box, *types):
    for t in types:
        box = child(b, box, t)
        if box is None: return None
    return box


def raw(b, box): return b[box[1]:box[1] + box[3]]
def payload(b, box): return b[box[1] + box[2]:box[1] + box[3]]
def mk(typ, data): return struct.pack('>I4s', 8 + len(data), typ) + data
def full(typ, version, flags, data): return mk(typ, struct.pack('>I', (version << 24) | flags) + data)


def main(src, dst):
    b = open(src, 'rb').read()
    top = boxes(b, 0, len(b))
    moov = next(x for x in top if x[0] == b'moov')
    trak = child(b, moov, b'trak')
    mdhd = path(b, trak, b'mdia', b'mdhd'); mp = payload(b, mdhd)
    timescale = struct.unpack('>I', mp[12:16] if mp[0] == 0 else mp[20:24])[0]
    trex = path(b, moov, b'mvex', b'trex')
    tx = payload(b, trex) if trex else b'\0' * 24
    d_dur, d_size, d_flags = struct.unpack('>III', tx[12:24])

    samples = []  # (data bytes, duration, sync, cto)
    for m in [x for x in top if x[0] == b'moof']:
        traf = child(b, m, b'traf'); tf = payload(b, child(b, traf, b'tfhd'))
        fl = struct.unpack('>I', tf[:4])[0] & 0xffffff; p = 8
        base = m[1]
        if fl & 0x1: base = struct.unpack('>Q', tf[p:p + 8])[0]; p += 8
        if fl & 0x2: p += 4
        t_dur, t_size, t_flags = d_dur, d_size, d_flags
        if fl & 0x8: t_dur = struct.unpack('>I', tf[p:p + 4])[0]; p += 4
        if fl & 0x10: t_size = struct.unpack('>I', tf[p:p + 4])[0]; p += 4
        if fl & 0x20: t_flags = struct.unpack('>I', tf[p:p + 4])[0]; p += 4
        for tr in [c for c in boxes(b, traf[1] + traf[2], traf[1] + traf[3]) if c[0] == b'trun']:
            r = payload(b, tr); v = r[0]; rf = struct.unpack('>I', r[:4])[0] & 0xffffff
            n = struct.unpack('>I', r[4:8])[0]; p = 8; at = base
            if rf & 0x1: at = base + struct.unpack('>i', r[p:p + 4])[0]; p += 4
            first = None
            if rf & 0x4: first = struct.unpack('>I', r[p:p + 4])[0]; p += 4
            for i in range(n):
                dur, size, flags, cto = t_dur, t_size, t_flags, 0
                if rf & 0x100: dur = struct.unpack('>I', r[p:p + 4])[0]; p += 4
                if rf & 0x200: size = struct.unpack('>I', r[p:p + 4])[0]; p += 4
                if rf & 0x400: flags = struct.unpack('>I', r[p:p + 4])[0]; p += 4
                if rf & 0x800: cto = struct.unpack('>i' if v else '>I', r[p:p + 4])[0]; p += 4
                if i == 0 and first is not None: flags = first
                samples.append((b[at:at + size], dur, not (flags & 0x10000), cto)); at += size
    if not samples: raise SystemExit('no samples found')
    # the last sample often has no duration: give it the one before it
    if samples[-1][1] == 0 and len(samples) > 1: samples[-1] = (samples[-1][0], samples[-2][1], samples[-1][2], samples[-1][3])
    total = sum(s[1] for s in samples)

    # sample tables
    stts, last = [], None
    for s in samples:
        if stts and stts[-1][1] == s[1]: stts[-1][0] += 1
        else: stts.append([1, s[1]])
    stts_b = full(b'stts', 0, 0, struct.pack('>I', len(stts)) + b''.join(struct.pack('>II', c, d) for c, d in stts))
    ctts_b = b''
    if any(s[3] for s in samples):
        runs = []
        for s in samples:
            if runs and runs[-1][1] == s[3]: runs[-1][0] += 1
            else: runs.append([1, s[3]])
        ctts_b = full(b'ctts', 1, 0, struct.pack('>I', len(runs)) + b''.join(struct.pack('>Ii', c, o) for c, o in runs))
    sync = [i + 1 for i, s in enumerate(samples) if s[2]]
    stss_b = full(b'stss', 0, 0, struct.pack('>I', len(sync)) + b''.join(struct.pack('>I', i) for i in sync)) if len(sync) < len(samples) else b''
    stsc_b = full(b'stsc', 0, 0, struct.pack('>IIII', 1, 1, len(samples), 1))
    stsz_b = full(b'stsz', 0, 0, struct.pack('>II', 0, len(samples)) + b''.join(struct.pack('>I', len(s[0])) for s in samples))
    stsd_b = raw(b, path(b, trak, b'mdia', b'minf', b'stbl', b'stsd'))

    movie_ts = struct.unpack('>I', payload(b, child(b, moov, b'mvhd'))[12:16] if payload(b, child(b, moov, b'mvhd'))[0] == 0 else payload(b, child(b, moov, b'mvhd'))[20:24])[0]
    movie_dur = total * movie_ts // timescale

    def patched(box, at0, at1, value):
        """a version 0 / version 1 full box with its duration field replaced"""
        d = bytearray(raw(b, box)); v = d[box[2]]
        if v == 0: struct.pack_into('>I', d, box[2] + at0, value)
        else: struct.pack_into('>Q', d, box[2] + at1, value)
        return bytes(d)
    mvhd_b = patched(child(b, moov, b'mvhd'), 16, 24, movie_dur)
    tkhd_b = patched(child(b, trak, b'tkhd'), 20, 28, movie_dur)
    mdhd_b = patched(mdhd, 16, 24, total)
    hdlr_b = raw(b, path(b, trak, b'mdia', b'hdlr'))
    minf = path(b, trak, b'mdia', b'minf')
    head = b''.join(raw(b, c) for c in boxes(b, minf[1] + minf[2], minf[1] + minf[3]) if c[0] != b'stbl')

    ftyp = mk(b'ftyp', b'isom' + struct.pack('>I', 512) + b'isomiso2avc1mp41')
    data = b''.join(s[0] for s in samples)

    def build(chunk_offset):
        stco = full(b'co64', 0, 0, struct.pack('>IQ', 1, chunk_offset))
        stbl = mk(b'stbl', stsd_b + stts_b + ctts_b + stss_b + stsc_b + stsz_b + stco)
        mdia = mk(b'mdia', mdhd_b + hdlr_b + mk(b'minf', head + stbl))
        return mk(b'moov', mvhd_b + mk(b'trak', tkhd_b + mdia))
    # moov first (fast start), so a player can begin before the whole file arrives
    moov_len = len(build(0)); mdat_head = struct.pack('>I4sQ', 1, b'mdat', 16 + len(data))
    moov_b = build(len(ftyp) + moov_len + len(mdat_head))
    with open(dst, 'wb') as f: f.write(ftyp + moov_b + mdat_head + data)
    print('%d frames, %.1f s, %d keyframes -> %s (%.1f MB)' % (len(samples), total / timescale, len(sync), dst, (len(ftyp) + len(moov_b) + 16 + len(data)) / 1e6))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
