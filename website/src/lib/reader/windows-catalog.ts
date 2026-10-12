export interface WindowItem {
  syntax: string;
  name: string;
  cls: string;
  code: string;
  html: string;
  expandable?: boolean;
  meta?: string;
  inline?: boolean;
}

export const windowsItems: WindowItem[] = [
  { syntax: "~~~", name: "horizontal rule", cls: "", code: "~~~", html: '<hr class="visible-hr">', expandable: true },
  { syntax: "~^~", name: "section break", cls: "", code: "~^~", html: '<p>Text before</p><hr class="invisible-hr"><p>Text after</p>', expandable: true },
  { syntax: "+-...-+", name: "wiki window", cls: "wiki-window", code: "+-\\nDarkness exploration records\\n\\nwindow example\\n-+", html: '<p><strong>Darkness exploration records</strong></p>\n<p>window example</p>', expandable: true, meta: "the first line is metadata and can be canceled out if you put a \\ before it" },
  { syntax: "+$...$+", name: "plain window", cls: "plain-window", code: "+$\\nplain window example\\n$+", html: '<p>plain window example</p>', expandable: true },
  { syntax: "+=...=+", name: "crt window", cls: "black-window", code: "+=\\ncrt window example\\n=+", html: '<p>crt window example</p>', expandable: true },
  { syntax: "+~...~+", name: "gsgw system window", cls: "system-window", code: "+~\\nTitle\\nBody text\\n~+", html: '<p>Title</p><p>Body text</p>', expandable: true, meta: "the first line becomes a styled title with divider lines, use \\ to suppress" },
  { syntax: "+. .+", name: "bare window", cls: "bare-window", code: "+.\\nbare window example\\n.+", html: '<p>bare window example</p>', expandable: true },
  { syntax: "&-...-&", name: "record window", cls: "record-window", code: "&-\\nDisaster management bureau\\n\\ndmb window example\\n-&", html: '<p><strong>Disaster management bureau</strong></p>\n<p>dmb window example</p>', expandable: true, meta: "the first line is metadata and can be canceled out if you put a \\ before it" },
  { syntax: "&$...$&", name: "followup window", cls: "followup-window", code: "&$\\nfollowup window example\\n$&", html: '<p>followup window example</p>', expandable: true },
  { syntax: "!-...-!", name: "note window", cls: "note-window", code: "!-\\nheader\\n\\nnote window example\\n-!", html: '<p><strong>header</strong></p>\n<p>note window example</p>', expandable: true, meta: "the first line is metadata and can be canceled out if you put a \\ before it" },
  { syntax: "!$...$!", name: "sticky window", cls: "sticky-window", code: "!$\\nsticky window example\\n$!", html: '<p>sticky window example</p>', expandable: true },
  { syntax: "!pb...pb!", name: "paper boat", cls: "paper-boat", code: "!pb\\npaper window example\\npb!", html: '<p>paper window example</p>', expandable: true },
  { syntax: "![...]!", name: "braun screen", cls: "braun-screen", code: "![\\nbraun screen example\\n]!", html: '<p>braun screen example</p>', expandable: true },
  { syntax: "$Brt...Brt$", name: "braun tv text", cls: "braun-tv-text", code: "$Brt\\nbraun tv text example\\nBrt$", html: '<p>braun tv text example</p>', expandable: true },
  { syntax: "$Brd...Brd$", name: "braun doll text", cls: "braun-doll-text", code: "$Brd\\nbraun doll text example\\nBrd$", html: '<p>braun doll text example</p>', expandable: true },
  { syntax: "★!...!★", name: "debut alert", cls: "debut-alert", code: "★!\\ndebut alert example\\n!★", html: '<p>debut alert example</p>', expandable: true },
  { syntax: "★:...:★", name: "sms window", cls: "sms-window", code: "★:\\n- PMD: left message\\nright message -\\ncentered message\\n:★", html: '<div class="sms-bubble sms-left" style="background:#FFF8D9;color:#222;">left message</div>\n<div class="sms-bubble sms-right" style="background:#FFF0E1;color:#222;">right message</div>\n<div class="sms-bubble sms-center">centered message</div>', expandable: true, meta: "Prefix with speaker code for colors: PMD (yellow), SAH (orange), BSJ (blue), LSJ (purple), KRB (pink), CE (red), RCW (green). - prefix = left, suffix - = right, no dash = centered" },
  { syntax: "★$...$★", name: "comment window", cls: "alert-window", code: "★$\\n[Title]\\n: Sub-Title\\nDescription\\n-Comment\\n└ reply\\n└└reply reply\\n$★", html: '<div class="comment-post-header"><div class="comment-post-title">Title</div><div class="comment-post-desc"><p>: Sub-Title</p><p>Description</p></div></div><div class="comment-section"><div class="comment">Comment</div><div class="comment-reply depth-1"><span class="reply-icon">└</span><span class="reply-body">reply</span></div><div class="comment-reply depth-2"><span class="reply-icon">└└</span><span class="reply-body">reply reply</span></div></div>', expandable: true, meta: "[title] = title, : desc = description, - comment = top-level comment, └ = reply (each └ adds a depth level, max 2)" },
  { syntax: "★=...=★", name: "debut achievement", cls: "debut-achievement", code: "★=\\n[Achievement]\\n[\\nitem one\\nitem two\\n]\\n=★", html: '<div class="debut-achievement-list"><div class="debut-achievement-list-item">item one</div><div class="debut-achievement-list-divider"></div><div class="debut-achievement-list-item">item two</div></div>', expandable: true, meta: "first line = title, [\\n lines \\n] = list, }text{ = sub-left, {text{ = sub-right, }[!]text} = alert-sub-left, {[!]text{ = alert-sub-right" },
  { syntax: "★-...-★", name: "debut window", cls: "debut-window", code: "★-\\nTitle\\n[label text]\\ncontent\\n-★", html: '<div class="debut-window-title">Title</div><div class="debut-window-label">label text</div><p>content</p>', expandable: true, meta: "first line = title (\\ to suppress), [text] on its own line = label div, use \\ before line to keep raw text" },
  { syntax: "}text}", name: "sub left", cls: "", code: "}left label}", html: '<span class="debut-achievement-sub debut-achievement-sub-left">left label</span>', expandable: true, inline: true },
  { syntax: "{text{", name: "sub right", cls: "", code: "{right label{", html: '<span class="debut-achievement-sub debut-achievement-sub-right">right label</span>', expandable: true, inline: true },
  { syntax: "}[!]text}", name: "alert sub left", cls: "", code: "}[!]alert label}", html: '<span class="alert-sub alert-sub-left">alert label</span>', expandable: true, inline: true },
  { syntax: "{[!]text{", name: "alert sub right", cls: "", code: "{[!]alert label{", html: '<span class="alert-sub alert-sub-right">alert label</span>', expandable: true, inline: true },
  { syntax: "$p...p$", name: "padding", cls: "padding-window", code: "$p\npadding example\np$", html: '<p>padding example</p>', expandable: true },
  { syntax: "<pagebreak>...</pagebreak>", name: "scare page", cls: "scare-page", code: "\<pagebreak>\nScare page example\n\</pagebreak>", html: '<p>Boo</p>', expandable: true, meta: "this is a scare page, it will be hidden until the user scrolls to it" },
];