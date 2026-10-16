import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {render} from '../../scripts/render-npc-observation.mjs';

const root=resolve(import.meta.dirname,'../..');
const template=readFileSync(join(root,'extension/md/LifeSigns_NpcObservationDiagnostic.xml'),'utf8');
const fixture={sourceSaveSha256:'a'.repeat(64),shipA:{idcode:'AAA-111'},shipB:{idcode:'BBB-222'},station:{idcode:'CCC-333'},person:{uiName:'Test Pilot'}};
const body=name=>{
  const at=template.indexOf(`<cue name="${name}"`);
  assert.ok(at>=0,`missing cue ${name}`);
  return template.slice(at,template.indexOf('</cue>',at)+6);
};

test('fixture rendering requires provenance and unambiguous, inert identifiers',()=>{
  const xml=render(template,fixture);
  assert.match(xml,/AAA-111/);
  assert.doesNotMatch(xml,/@(?:SHIP|STATION|PERSON)_/);
  for(const bad of [
    {...fixture,sourceSaveSha256:''},
    {...fixture,shipB:{idcode:'AAA-111'}},
    {...fixture,person:{uiName:"Test' + evil"}},
    {...fixture,station:{idcode:'CCC-333\n'}}
  ]) assert.throws(()=>render(template,bad));
});

test('enrolment freezes one attempt and requires exact fixture counts and original pilot readback',()=>{
  const dock=body('Docked');
  assert.match(dock,/not md\.\$LifeSignsNpcObsAttempted/);
  assert.match(dock,/name="md\.\$LifeSignsNpcObsAttempted" exact="true"/);
  assert.match(dock,/\$AMatches == 1 and \$BMatches == 1 and \$SMatches == 1/);
  assert.match(dock,/\$CandidateA\.assignedaipilot/);
  assert.match(dock,/\$Pilot\.isclass\.npc and \$Pilot\.name/);
  assert.match(dock,/\$LifeSignsNpcObsOriginalP1 == \$Pilot/);
  assert.match(dock,/RETAINED_REFERENCE_MISSING/);
  assert.match(dock,/READBACK_MISMATCH/);
});

test('retained anchors never rebind; unavailable anchors and new post occupants stay separate',()=>{
  for(const name of ['OriginalP1','OriginalTemplate']) {
    const writes=[...template.matchAll(new RegExp(`<set_value name="md\\.\\$LifeSignsNpcObs${name}"`,'g'))];
    assert.equal(writes.length,1,`${name} must only be captured during enrolment`);
  }
  for(const label of ['A','B','S']) {
    const writes=[...template.matchAll(new RegExp(`<set_value name="md\\.\\$LifeSignsNpcObsRefs\\.\\$${label}"`,'g'))];
    assert.equal(writes.length,1,`${label} reference must not be rebound`);
  }
  const snap=body('Snapshot');
  assert.match(snap,/MISSING_REFERENCE/);
  assert.match(snap,/OUT_OF_GRAPH/);
  assert.match(snap,/VACANT_OR_UNAVAILABLE/);
  assert.match(snap,/occupant_equal_original=/);
  assert.match(snap,/\$Occupant == md\.\$LifeSignsNpcObsOriginalP1/);
  assert.doesNotMatch(snap,/person_death|is_dead|KILLED/);
  const conversation=body('ConversationObserved');
  assert.match(conversation,/template_equal_original=/);
  assert.match(conversation,/seed_render=UNVERIFIED/);
});

test('probe writes only a diagnostic log prefix and reads production session key',()=>{
  const debug=[...template.matchAll(/<debug_text text="([^"]+)/g)];
  assert.ok(debug.length>0);
  for(const [,line] of debug) assert.match(line,/LIFESIGNS_NPC_OBS_V1\|/);
  assert.doesNotMatch(template,/<write_to_file|<set_value name="md\.\$LifeSignsProduction/);
  assert.match(template,/md\.\$LifeSignsProductionSessionKey/);
});

test('optional deployment uses rendered ignored source, preserves baseline and removes explicitly',
  {skip:process.platform!=='win32'},()=>{
    const game=mkdtempSync(join(tmpdir(),'npc-observation-game-'));
    const local=join(root,'local-data');
    mkdirSync(local,{recursive:true});
    const sourceDir=mkdtempSync(join(local,'npc-observation-test-'));
    const source=join(sourceDir,'LifeSigns_NpcObservationDiagnostic.xml');
    const script=join(root,'scripts/deploy-bridge-probe.ps1');
    const run=(...args)=>spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',script,'-GamePath',game,...args],{encoding:'utf8'});
    try {
      writeFileSync(join(game,'X4.exe'),'fake');
      writeFileSync(source,render(template,fixture));
      assert.equal(run('-NpcObservationDiagnostic','-NpcObservationSourcePath',source,'-WhatIf').status,0);
      const target=join(game,'extensions/lifesigns_bridge_probe/md/LifeSigns_NpcObservationDiagnostic.xml');
      assert.equal(existsSync(target),false);
      const deployed=run('-NpcObservationDiagnostic','-NpcObservationSourcePath',source);
      assert.equal(deployed.status,0,deployed.stderr);
      assert.equal(readFileSync(target,'utf8'),readFileSync(source,'utf8'));
      assert.equal(existsSync(join(game,'extensions/lifesigns_bridge_probe/md/LifeSigns_BridgeProbe.xml')),true);
      assert.notEqual(run().status,0);
      assert.equal(run('-RemoveNpcObservationDiagnostic').status,0);
      assert.equal(existsSync(target),false);
      assert.equal(run().status,0);
      writeFileSync(source,template);
      assert.notEqual(run('-NpcObservationDiagnostic','-NpcObservationSourcePath',source).status,0);
      assert.equal(existsSync(target),false);
    } finally {
      rmSync(game,{recursive:true,force:true});
      rmSync(sourceDir,{recursive:true,force:true});
    }
  });
