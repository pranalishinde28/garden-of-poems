/* ================= the library's famous books: the opening pages of public-domain classics ================= */
// All in the public domain (published before 1929 in the US; translations too). Each is read in full here (the
// text is fetched from public/books when opened); the opening pages below show while it loads. [title, author, year, cover colour, text]
const Q = s => s;
// the whole book, as plain text in public/books (CREDITS.md there), fetched when the book is opened; the opening
// pages below show at once and stand in if the fetch fails
const FILES = ['pride-and-prejudice', 'alice', 'secret-garden', 'two-cities', 'moby-dick', 'jane-eyre', 'little-women', 'happy-prince', 'gitanjali', 'peter-pan', 'frankenstein', 'walden', 'meditations'];
export const FAMOUS = [
  ['Pride and Prejudice', 'Jane Austen', 1813, '#7a2e2a', Q(`It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.

However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.

“My dear Mr. Bennet,” said his lady to him one day, “have you heard that Netherfield Park is let at last?”

Mr. Bennet replied that he had not.

“But it is,” returned she; “for Mrs. Long has just been here, and she told me all about it.”

Mr. Bennet made no answer.

“Do you not want to know who has taken it?” cried his wife impatiently.

“You want to tell me, and I have no objection to hearing it.”

This was invitation enough.

“Why, my dear, you must know, Mrs. Long says that Netherfield is taken by a young man of large fortune from the north of England; that he came down on Monday in a chaise and four to see the place, and was so much delighted with it, that he agreed with Mr. Morris immediately; that he is to take possession before Michaelmas, and some of his servants are to be in the house by the end of next week.”

“What is his name?”

“Bingley.”

“Is he married or single?”

“Oh! Single, my dear, to be sure! A single man of large fortune; four or five thousand a year. What a fine thing for our girls!”

“How so? How can it affect them?”

“My dear Mr. Bennet,” replied his wife, “how can you be so tiresome! You must know that I am thinking of his marrying one of them.”

“Is that his design in settling here?”

“Design! Nonsense, how can you talk so! But it is very likely that he may fall in love with one of them, and therefore you must visit him as soon as he comes.”`)],
  ['Alice’s Adventures in Wonderland', 'Lewis Carroll', 1865, '#2f5a7a', Q(`Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, “and what is the use of a book,” thought Alice “without pictures or conversations?”

So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.

There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to hear the Rabbit say to itself, “Oh dear! Oh dear! I shall be late!” (when she thought it over afterwards, it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); but when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it, and then hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole under the hedge.

In another moment down went Alice after it, never once considering how in the world she was to get out again.

The rabbit-hole went straight on like a tunnel for some way, and then dipped suddenly down, so suddenly that Alice had not a moment to think about stopping herself before she found herself falling down a very deep well.`)],
  ['The Secret Garden', 'Frances Hodgson Burnett', 1911, '#3f6a3a', Q(`When Mary Lennox was sent to Misselthwaite Manor to live with her uncle everybody said she was the most disagreeable-looking child ever seen. It was true, too. She had a little thin face and a little thin body, thin light hair and a sour expression. Her hair was yellow, and her face was yellow because she had been born in India and had always been ill in one way or another.`)],
  ['A Tale of Two Cities', 'Charles Dickens', 1859, '#5a2a3a', Q(`It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness, it was the spring of hope, it was the winter of despair, we had everything before us, we had nothing before us, we were all going direct to Heaven, we were all going direct the other way—in short, the period was so far like the present period, that some of its noisiest authorities insisted on its being received, for good or for evil, in the superlative degree of comparison only.

There were a king with a large jaw and a queen with a plain face, on the throne of England; there were a king with a large jaw and a queen with a fair face, on the throne of France. In both countries it was clearer than crystal to the lords of the State preserves of loaves and fishes, that things in general were settled for ever.`)],
  ['Moby-Dick', 'Herman Melville', 1851, '#25404f', Q(`Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way I have of driving off the spleen and regulating the circulation. Whenever I find myself growing grim about the mouth; whenever it is a damp, drizzly November in my soul; whenever I find myself involuntarily pausing before coffin warehouses, and bringing up the rear of every funeral I meet; and especially whenever my hypos get such an upper hand of me, that it requires a strong moral principle to prevent me from deliberately stepping into the street, and methodically knocking people’s hats off—then, I account it high time to get to sea as soon as I can. This is my substitute for pistol and ball. With a philosophical flourish Cato throws himself upon his sword; I quietly take to the ship. There is nothing surprising in this. If they but knew it, almost all men in their degree, some time or other, cherish very nearly the same feelings towards the ocean with me.`)],
  ['Jane Eyre', 'Charlotte Brontë', 1847, '#4a3a5a', Q(`There was no possibility of taking a walk that day. We had been wandering, indeed, in the leafless shrubbery an hour in the morning; but since dinner (Mrs. Reed, when there was no company, dined early) the cold winter wind had brought with it clouds so sombre, and a rain so penetrating, that further out-door exercise was now out of the question.

I was glad of it: I never liked long walks, especially on chilly afternoons: dreadful to me was the coming home in the raw twilight, with nipped fingers and toes, and a heart saddened by the chidings of Bessie, the nurse, and humbled by the consciousness of my physical inferiority to Eliza, John, and Georgiana Reed.`)],
  ['Little Women', 'Louisa May Alcott', 1868, '#8a4a5a', Q(`“Christmas won’t be Christmas without any presents,” grumbled Jo, lying on the rug.

“It’s so dreadful to be poor!” sighed Meg, looking down at her old dress.

“I don’t think it’s fair for some girls to have plenty of pretty things, and other girls nothing at all,” added little Amy, with an injured sniff.

“We’ve got Father and Mother, and each other,” said Beth contentedly from her corner.

The four young faces on which the firelight shone brightened at the cheerful words, but darkened again as Jo said sadly, “We haven’t got Father, and shall not have him for a long time.” She didn’t say “perhaps never,” but each silently added it, thinking of Father far away, where the fighting was.`)],
  ['The Happy Prince', 'Oscar Wilde', 1888, '#7a6a2a', Q(`High above the city, on a tall column, stood the statue of the Happy Prince. He was gilded all over with thin leaves of fine gold, for eyes he had two bright sapphires, and a large red ruby glowed on his sword-hilt.

He was very much admired indeed. “He is as beautiful as a weathercock,” remarked one of the Town Councillors who wished to gain a reputation for having artistic tastes; “only not quite so useful,” he added, fearing lest people should think him unpractical, which he really was not.

“Why can’t you be like the Happy Prince?” asked a sensible mother of her little boy who was crying for the moon. “The Happy Prince never dreams of crying for anything.”

“I am glad there is some one in the world who is quite happy,” muttered a disappointed man as he gazed at the wonderful statue.

One night there flew over the city a little Swallow. His friends had gone away to Egypt six weeks before, but he had stayed behind, for he was in love with the most beautiful Reed.`)],
  ['Gitanjali', 'Rabindranath Tagore', 1912, '#9a5a20', Q(`Thou hast made me endless, such is thy pleasure. This frail vessel thou emptiest again and again, and fillest it ever with fresh life.

This little flute of a reed thou hast carried over hills and dales, and hast breathed through it melodies eternally new.

At the immortal touch of thy hands my little heart loses its limits in joy and gives birth to utterance ineffable.

Thy infinite gifts come to me only on these very small hands of mine. Ages pass, and still thou pourest, and still there is room to fill.

· · ·

Where the mind is without fear and the head is held high;
Where knowledge is free;
Where the world has not been broken up into fragments by narrow domestic walls;
Where words come out from the depth of truth;
Where tireless striving stretches its arms towards perfection;
Where the clear stream of reason has not lost its way into the dreary desert sand of dead habit;
Where the mind is led forward by thee into ever-widening thought and action—
Into that heaven of freedom, my Father, let my country awake.`)],
  ['Peter Pan', 'J. M. Barrie', 1911, '#2f6a4a', Q(`All children, except one, grow up. They soon know that they will grow up, and the way Wendy knew was this. One day when she was two years old she was playing in a garden, and she plucked another flower and ran with it to her mother. I suppose she must have looked rather delightful, for Mrs. Darling put her hand to her heart and cried, “Oh, why can’t you remain like this for ever!” This was all that passed between them on the subject, but henceforth Wendy knew that she must grow up. You always know after you are two. Two is the beginning of the end.`)],
  ['Frankenstein', 'Mary Shelley', 1818, '#3a3a3a', Q(`To Mrs. Saville, England.

St. Petersburgh, Dec. 11th, 17—.

You will rejoice to hear that no disaster has accompanied the commencement of an enterprise which you have regarded with such evil forebodings. I arrived here yesterday, and my first task is to assure my dear sister of my welfare and increasing confidence in the success of my undertaking.

I am already far north of London, and as I walk in the streets of Petersburgh, I feel a cold northern breeze play upon my cheeks, which braces my nerves and fills me with delight.`)],
  ['Walden', 'Henry David Thoreau', 1854, '#5a6a3a', Q(`I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived. I did not wish to live what was not life, living is so dear; nor did I wish to practise resignation, unless it was quite necessary. I wanted to live deep and suck out all the marrow of life.`)],
  ['Meditations', 'Marcus Aurelius (tr. George Long, 1862)', '170', '#6a4a2a', Q(`Begin the morning by saying to thyself, I shall meet with the busy-body, the ungrateful, arrogant, deceitful, envious, unsocial. All these things happen to them by reason of their ignorance of what is good and evil.`)],
].map(([title, author, year, color, text], i) => ({ id: 'f:' + title, title, author, year, color, text, famous: true, file: FILES[i] }));
export const gutenberg = b => 'https://www.gutenberg.org/ebooks/search/?query=' + encodeURIComponent(b.title + ' ' + b.author.replace(/\s*\(.*\)/, ''));
