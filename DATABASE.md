# X4LifeSigns persistence requirements

## Current status

SQLite is the intended persistence technology. No database implementation, schema or migrations exist yet.

## Initial requirements

For the proposed first milestone, persistence should:

- associate a real captured event with the entity involved
- retain enough event context to produce a truthful text acknowledgement
- keep the record readable after a service restart
- preserve the association with the same entity when it is encountered again
- keep histories from separate game universes from being mixed

These are requirements, not a defined storage format. Table names, fields, identity formats, save identification, migration mechanics and duplicate event handling will be documented when implementation establishes them. Identity stability and save/reload behaviour must be verified rather than assumed.

## Conversations and voice

The database may store text conversation history where it is useful for character memory or context.

Raw microphone audio and generated speech audio should not normally be stored permanently.

If voice-related data is stored, it should preferably be limited to useful metadata such as:

- transcribed player speech
- NPC text response
- speaker identity
- selected voice
- conversation timestamp
- related NPC or entity ID
- significant conversation events

Voice data should only be retained when it serves a clear gameplay or debugging purpose.

Temporary generated audio should normally be treated as cache data rather than persistent Life Signs data.
