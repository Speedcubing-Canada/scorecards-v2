// ?inline forces Vite to embed each PNG as a base64 data URL regardless of file size.
// This is required for the PDF worker: react-pdf routes /path URLs through fs.readFile
// (which doesn't exist in a browser Worker), but data URIs take a fast inline code path.
import i222    from './events/222.png?inline';
import i333    from './events/333.png?inline';
import i444    from './events/444.png?inline';
import i555    from './events/555.png?inline';
import i666    from './events/666.png?inline';
import i777    from './events/777.png?inline';
import i333bf  from './events/333bf.png?inline';
import i333fm  from './events/333fm.png?inline';
import i333oh  from './events/333oh.png?inline';
import iclock  from './events/clock.png?inline';
import iminx   from './events/minx.png?inline';
import ipyram  from './events/pyram.png?inline';
import iskewb  from './events/skewb.png?inline';
import isq1    from './events/sq1.png?inline';
import i444bf  from './events/444bf.png?inline';
import i555bf  from './events/555bf.png?inline';
import i333mbf from './events/333mbf.png?inline';

export const EVENT_ICONS: Record<string, string> = {
  '222': i222, '333': i333, '444': i444, '555': i555,
  '666': i666, '777': i777, '333bf': i333bf, '333fm': i333fm,
  '333oh': i333oh, 'clock': iclock, 'minx': iminx, 'pyram': ipyram,
  'skewb': iskewb, 'sq1': isq1, '444bf': i444bf, '555bf': i555bf,
  '333mbf': i333mbf,
};
