# The interactive architecture map

`merit.architecture.json` is the source: twelve components, eleven relationships, two
boundaries, three guided views, and a source reference on every component pinned to commit
`b37bcc6d46e17c9cb6cbfc236850aa602b841e1d` of this repository. It was compiled with
[Archify](https://github.com/tt-a1i/archify) (v3.2) into a single standalone page,
`public/architecture.html`, which the site serves at
[meritdue.com/architecture.html](https://www.meritdue.com/architecture.html).

Open it and click any component: the source card shows the lines it cites, at that commit.
The three views at the top walk the three flows (subscribe, the adviser's book, the private
payout). Route traces a path between two nodes; Lens isolates one kind of component.

`merit-architecture.png` is a still of the light theme for readers who cannot open the page.
`architecture.delivery.json` is Archify's delivery receipt (the hashes of the source and the
page it produced).

To rebuild after a change to the JSON, from the repository root with Archify checked out:

```bash
ARCHIFY_CHROME=<path to chrome> node <archify>/archify/bin/archify.mjs finalize architecture \
  docs/architecture/merit.architecture.json public/architecture.html --repo-root . --quality showcase --json
```

Finalize validates the schema, verifies every cited line range against the committed bytes at
the pinned revision, renders the page, and checks it in a real browser. Update
`meta.repository.revision` first if the cited files have moved.
