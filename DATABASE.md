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