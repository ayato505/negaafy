"""Long-running yt-dlp worker: reads one JSON request per line on stdin and answers
one JSON line on stdout. Keeping yt-dlp loaded skips ~3 s of startup per song."""
import json
import sys
import threading
from concurrent.futures import ThreadPoolExecutor

import yt_dlp

# "low" is used by Lite mode: the smallest AAC stream, about a third of the data
FORMATS = {
    'best': 'bestaudio[ext=m4a]/bestaudio',
    'low': 'worstaudio[ext=m4a]/worstaudio',
}
OPTS = {
    'quiet': True,
    'no_warnings': True,
    'noplaylist': True,
    'skip_download': True,
    'noprogress': True,
}
local = threading.local()
out_lock = threading.Lock()


def ydl(quality):
    if not hasattr(local, 'ydls'):
        local.ydls = {}
    fmt = FORMATS.get(quality, FORMATS['best'])
    if fmt not in local.ydls:
        local.ydls[fmt] = yt_dlp.YoutubeDL({**OPTS, 'format': fmt})
    return local.ydls[fmt]


def reply(msg):
    with out_lock:
        sys.stdout.write(json.dumps(msg, ensure_ascii=True) + '\n')
        sys.stdout.flush()


def lookup(req):
    try:
        info = ydl(req.get('q', 'best')).extract_info('https://www.youtube.com/watch?v=' + req['id'], download=False)
        fmt = (info.get('requested_formats') or [info])[0]
        reply({'rid': req['rid'], 'ok': True, 'info': {
            'url': fmt['url'],
            'headers': fmt.get('http_headers') or info.get('http_headers') or {},
            'title': info.get('title'),
            'channel': info.get('channel') or info.get('uploader'),
            'duration': info.get('duration'),
        }})
    except Exception as e:  # report every failure to the app instead of dying
        reply({'rid': req['rid'], 'ok': False, 'error': str(e)[-300:]})


def main():
    pool = ThreadPoolExecutor(max_workers=6)
    reply({'ready': True, 'version': yt_dlp.version.__version__})
    for line in sys.stdin:
        line = line.strip()
        if line:
            pool.submit(lookup, json.loads(line))


if __name__ == '__main__':
    main()
