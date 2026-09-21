import assert from 'node:assert/strict';
import test from 'node:test';

import { applyTextCommand } from '../src/lib/commandParser.ts';

const node = (id, label, x = 0, y = 0) => ({
  id,
  type: 'default',
  position: { x, y },
  data: { label },
});

const edge = (id, source, target) => ({ id, source, target });

const stateWith = (nodes = [], edges = []) => ({ nodes, edges });

test('adds nodes with normalized labels and accepts case and whitespace variations', () => {
  const result = applyTextCommand('  ADD   NODE   Load   Balancer  ', stateWith());

  assert.equal(result.ok, true);
  assert.equal(result.nodes[0].data.label, 'Load Balancer');
  assert.match(result.message, /Added node/);

  const duplicate = applyTextCommand('add node load balancer', result);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.nodes.length, 1);
  assert.match(duplicate.message, /already exists/);
});

test('supports quoted labels containing spaces', () => {
  const added = applyTextCommand('add node "API Gateway"', stateWith());
  assert.equal(added.ok, true);
  assert.equal(added.nodes[0].data.label, 'API Gateway');

  const removed = applyTextCommand("delete node 'api gateway'", added);
  assert.equal(removed.ok, true);
  assert.equal(removed.nodes.length, 0);
});

test('supports quoted edge endpoints when labels contain command separators', () => {
  const first = applyTextCommand('add node "Service to Cache"', stateWith());
  const initial = applyTextCommand("add node 'Data -> Store'", first);
  assert.equal(initial.ok, true);

  const connected = applyTextCommand(
    'connect "Service to Cache" to \'Data -> Store\'',
    initial,
  );
  assert.equal(connected.ok, true);
  assert.equal(connected.edges.length, 1);

  const removed = applyTextCommand(
    "disconnect 'Service to Cache' from \"Data -> Store\"",
    connected,
  );
  assert.equal(removed.ok, true);
  assert.equal(removed.edges.length, 0);
});

test('connects existing nodes and rejects duplicate, missing, and self edges', () => {
  const initial = stateWith([
    node('a', 'Internet'),
    node('b', 'Load Balancer'),
    node('c', 'Database'),
  ]);

  const connected = applyTextCommand('connect internet to LOAD   BALANCER', initial);
  assert.equal(connected.ok, true);
  assert.deepEqual(connected.edges, [edge(connected.edges[0].id, 'a', 'b')]);

  const duplicate = applyTextCommand('add edge Internet to Load Balancer', connected);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.edges.length, 1);

  const missing = applyTextCommand('connect Missing Service to Database', initial);
  assert.equal(missing.ok, false);
  assert.match(missing.message, /Missing node\(s\): Missing Service/);

  const self = applyTextCommand('connect Database -> database', initial);
  assert.equal(self.ok, false);
  assert.match(self.message, /different nodes/);
});

test('removes edges through aliases and reports missing edges cleanly', () => {
  const initial = stateWith(
    [node('a', 'Web Server'), node('b', 'Database')],
    [edge('ab', 'a', 'b')],
  );

  const removed = applyTextCommand('  DISCONNECT  web server  FROM  DATABASE ', initial);
  assert.equal(removed.ok, true);
  assert.equal(removed.edges.length, 0);

  const missing = applyTextCommand('remove edge Web Server to Database', removed);
  assert.equal(missing.ok, false);
  assert.match(missing.message, /No edge exists/);

  const absentNode = applyTextCommand('disconnect Web Server from Missing', initial);
  assert.equal(absentNode.ok, false);
  assert.match(absentNode.message, /Both nodes must exist/);
});

test('removing a node also removes every attached edge', () => {
  const initial = stateWith(
    [node('a', 'Internet'), node('b', 'Web Server'), node('c', 'Database')],
    [edge('ab', 'a', 'b'), edge('bc', 'b', 'c'), edge('ac', 'a', 'c')],
  );

  const result = applyTextCommand('remove node web server', initial);
  assert.equal(result.ok, true);
  assert.deepEqual(result.nodes.map(({ id }) => id), ['a', 'c']);
  assert.deepEqual(result.edges.map(({ id }) => id), ['ac']);
});

test('uses an unoccupied layout slot after deleting and re-adding a node', () => {
  let state = stateWith();
  for (const label of ['A', 'B', 'C']) {
    const result = applyTextCommand(`add node ${label}`, state);
    assert.equal(result.ok, true);
    state = result;
  }

  const removed = applyTextCommand('remove node A', state);
  assert.equal(removed.ok, true);
  const added = applyTextCommand('add node D', removed);
  assert.equal(added.ok, true);

  const positions = added.nodes.map(({ position }) => `${position.x}:${position.y}`);
  assert.equal(new Set(positions).size, positions.length);
});

test('places new nodes clear of the initial graph and dragged nodes', () => {
  const initial = stateWith([
    node('internet', 'Internet', 60, 130),
    node('web', 'Web Server', 330, 130),
    node('database', 'Database', 600, 130),
    node('dragged', 'Dragged Node', 80, 80),
  ]);
  const result = applyTextCommand('add node Cache', initial);

  assert.equal(result.ok, true);
  const added = result.nodes.at(-1);
  const addedBounds = {
    left: added.position.x,
    top: added.position.y,
    right: added.position.x + 160,
    bottom: added.position.y + 80,
  };

  for (const existing of initial.nodes) {
    const width = Math.max(160, existing.width ?? existing.measured?.width ?? 0);
    const height = Math.max(80, existing.height ?? existing.measured?.height ?? 0);
    const bounds = {
      left: existing.position.x - 16,
      top: existing.position.y - 16,
      right: existing.position.x + width + 16,
      bottom: existing.position.y + height + 16,
    };
    assert.equal(
      addedBounds.left < bounds.right &&
        addedBounds.right > bounds.left &&
        addedBounds.top < bounds.bottom &&
        addedBounds.bottom > bounds.top,
      false,
      `new node overlaps ${existing.data.label}`,
    );
  }
});

test('rejects empty, malformed, and overlong commands without changing state', () => {
  const initial = stateWith();

  for (const input of ['', 'not a command', 'add node', 'connect A']) {
    const result = applyTextCommand(input, initial);
    assert.equal(result.ok, false, input);
    assert.deepEqual(result.nodes, initial.nodes, input);
    assert.deepEqual(result.edges, initial.edges, input);
  }

  const tooLong = applyTextCommand(`add node ${'x'.repeat(81)}`, initial);
  assert.equal(tooLong.ok, false);
  assert.match(tooLong.message, /80 characters/);
  assert.equal(tooLong.nodes.length, 0);
});
