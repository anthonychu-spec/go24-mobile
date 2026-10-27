import { brandContent, type Programme } from '../../brand';

/** Brand copy and photo for a PGM class name; unknown names keep their own name and the banner photo. */
export function programmeFor(className: string | null | undefined): Programme {
  const content = brandContent!;
  const name = (className ?? '').trim();
  const hit = content.programmes.find((p) => name.toLowerCase().includes(p.match.toLowerCase()));
  return hit ?? {
    match: name,
    name: name.toUpperCase() || 'SESSION',
    pillar: '',
    description: '',
    image: content.book.banner.image,
  };
}
