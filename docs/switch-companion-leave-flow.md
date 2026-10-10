# Switch Companion leave flow

Saving a dump is the boundary between the editable draft and background work.
Persist it as `pending`, close the sheet immediately, then run transcription
and splitting. A processing failure keeps the saved input and exposes Retry on
the task card.

| State | Event | Persisted state | User interface |
|---|---|---|---|
| Draft | Open Leave | No dump | Type or start a recording. Cancel is available only while the draft is empty. A non-empty draft stays when the sheet is dismissed. |
| Microphone permission | Start recording | Pending voice dump before requesting permission | Ask the OS for permission. If denied, mark the dump failed and explain how to enable access; the sheet remains open. |
| Recording | Permission granted | Pending voice dump | Record locally. Finish saves the audio, closes the sheet, and starts processing in the background. |
| Network | A saved dump starts processing | Pending dump | If offline, close the sheet and retain the dump for retry. |
| Transcription | Voice dump has audio | Pending dump, then transcript and detected language | Transcribe in the background; the sheet stays closed. Failure retains audio and any raw text. |
| Split | Text or transcript is ready | Pending dump | Split in the background into `whereIWas`, loose ends, and `nextStep`. |
| Done | Split succeeds | Done dump and loose ends | The saved note is available on the task card. |
| Failed | Network, transcription, or split fails | Failed dump with raw text and audio when available | Show “Not sorted yet”, the saved raw text, and Retry. Explain that the note is saved, sorting failed, and can be retried now or later. |

Cancel never deletes a saved dump. After a dump is saved, the sheet closes and
there is no Cancel action in the processing or failure state.
