import math
from bisect import bisect_left

EARTH_MI = 3958.8
MI_PER_DEG = 69.17


def haversine_mi(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * EARTH_MI * math.asin(math.sqrt(h))


def cumulative_miles(coords):
    cum = [0.0]
    for p, q in zip(coords, coords[1:]):
        cum.append(cum[-1] + haversine_mi(p, q))
    return cum


def point_at(coords, cum, miles):
    """Interpolated (lat, lon) at a distance along the polyline."""
    if miles <= 0:
        return coords[0]
    if miles >= cum[-1]:
        return coords[-1]
    i = bisect_left(cum, miles)
    seg = cum[i] - cum[i - 1]
    t = (miles - cum[i - 1]) / seg if seg else 0.0
    a, b = coords[i - 1], coords[i]
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def thin(coords, max_points):
    if len(coords) <= max_points:
        return list(coords)
    step = math.ceil(len(coords) / max_points)
    out = coords[::step]
    if out[-1] != coords[-1]:
        out.append(coords[-1])
    return out


def _flat_dist_mi(a, b):
    dx = (a[1] - b[1]) * math.cos(math.radians((a[0] + b[0]) / 2)) * MI_PER_DEG
    dy = (a[0] - b[0]) * MI_PER_DEG
    return math.hypot(dx, dy)


def overlap_fraction(a, b, tol_mi=1.5, samples=30):
    """Fraction of sampled points on polyline `a` lying within tol_mi of polyline `b`."""
    b_small = thin(b, 400)
    picks = [a[int(i * (len(a) - 1) / (samples - 1))] for i in range(samples)]
    near = sum(1 for p in picks if min(_flat_dist_mi(p, q) for q in b_small) <= tol_mi)
    return near / samples
