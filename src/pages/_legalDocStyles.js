// Style helpers a SECTIONS content() function can import instead of
// redefining its own inline S object. Kept minimal — most legal copy
// only needs a paragraph, a list, and an occasional emphasis span.
import { T } from '../components/landing/_tokens';

export const docStyles = {
  p: { color: T.textSoft, lineHeight: 1.8, fontSize: 14.5, margin: '0 0 12px' },
  ul: { color: T.textSoft, lineHeight: 1.8, fontSize: 14.5, paddingLeft: 20, margin: '0 0 12px' },
  strong: { color: T.text, fontWeight: 600 },
  highlight: { color: T.green, fontWeight: 600 },
  warn: { color: T.gold, fontWeight: 600 },
};
