import { describe, expect, it } from 'vitest';
import { compare, headlineNumber, resultGrid, shareText } from '../src/lib/share';
import { injectMeta } from '../seo/meta.mjs';

describe('share copy',()=>{
  it('leads with reaction time only when one was measured',()=>{
    expect(headlineNumber('quick-reflex',{score:6,best_ms:213})).toEqual({value:'213 ms',label:'best reaction'});
    expect(headlineNumber('quick-reflex',{score:0,best_ms:null}).value).toBe('0');
    expect(headlineNumber('classic',{score:1,best_ms:null}).label).toBe('round cleared');
  });
  it('builds a spoiler-free daily grid capped at ten squares',()=>{
    expect(resultGrid(3)).toBe('🟩🟩🟩🟥');
    expect(resultGrid(14)).toBe('🟩'.repeat(10)+' +4🟥');
    expect(shareText('trail-tracker',{score:3,best_ms:null,daily_number:12})).toBe('Dopamine Rush #12 ⚡ Trail Tracker\n🟩🟩🟩🟥 3 rounds');
  });
  it('compares challenge results on rounds, then reaction time',()=>{
    expect(compare({score:5},{score:4})).toBeGreaterThan(0);
    expect(compare({score:5,best_ms:200},{score:5,best_ms:230})).toBeGreaterThan(0);
    expect(compare({score:5,best_ms:null},{score:5,best_ms:230})).toBe(0);
  });
});
describe('link previews',()=>{
  const shell='<html><head><title>Old</title><meta name="description" content="old" /><meta property="og:title" content="old" /></head><body><div id="root"></div></body></html>';
  it('replaces old tags and escapes player-provided text',()=>{
    const html=injectMeta(shell,{title:'Beat <b>"Ali"</b>',description:'d',url:'https://x.test/c/a',image:'https://x.test/og'});
    expect(html.match(/<title>/g)).toHaveLength(1);expect(html).not.toContain('content="old"');
    expect(html).toContain('Beat &lt;b&gt;&quot;Ali&quot;&lt;/b&gt;');expect(html).toContain('summary_large_image');
  });
  it('keeps JSON-LD from closing the script tag',()=>{
    expect(injectMeta(shell,{title:'t',description:'d',url:'u',jsonLd:{name:'</script><x>'}})).not.toContain('</script><x>');
  });
});
