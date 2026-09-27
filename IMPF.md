# IMPF 1.0

IMPF is Coldmail's native Internet Mail Provider Format.

Required: IMPF-Version, Adressant, at least one recipient, Subject, Date, Message-ID, Content-Type, Priority, and body delimiters.

Optional: CC, BCC, Reply-To, In-Reply-To, Thread-ID, Attachments, Labels.

Bodies are untrusted data and must be rendered as text or through a safe formatting parser.