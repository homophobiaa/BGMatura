/**
 * The editorial services report problems in English for developers and logs.
 * Editors read Bulgarian, so the admin forms translate the known messages here.
 * Unknown English text (for example a generic schema message) becomes a general
 * Bulgarian hint instead of leaking technical wording into the form.
 */
const translations: Record<string, string> = {
  "Check the highlighted fields.": "Провери отбелязаните полета.",
  "This slug or identifier is already in use.": "Този адрес (slug) вече се използва.",
  "Choose a unique slug.": "Избери адрес, който още не се използва.",
  "A required relation is missing or still in use.": "Липсва свързан запис или записът още се използва.",
  "The record no longer exists.": "Записът вече не съществува.",
  "The record changed. Reload and try again.": "Записът е променен междувременно. Презареди страницата и опитай отново.",
  "The draft changed. Reload it before saving.": "Черновата е променена междувременно. Презареди страницата, преди да запазиш.",
  "Use letters, numbers, and single hyphens.": "Използвай букви, цифри и единични тирета.",
  "Unpublish this record before editing it.": "Свали записа от публикация, преди да го редактираш.",
  "Choose an existing author.": "Избери съществуващ автор.",
  "The author does not exist.": "Авторът не съществува.",
  "Unlink dependent records before changing this topic's subject.": "Премахни свързаните подтеми, уроци и въпроси, преди да смениш предмета.",
  "A topic cannot become its own ancestor.": "Темата не може да бъде собствена родителска тема.",
  "Choose a parent outside this topic's descendants.": "Избери родителска тема извън подтемите на тази тема.",
  "Choose an existing parent of the same subject.": "Избери съществуваща родителска тема от същия предмет.",
  "Invalid parent topic.": "Невалидна родителска тема.",
  "Choose an existing language topic.": "Избери съществуваща тема по български език.",
  "Invalid language topic.": "Невалидна тема по български език.",
  "Text must not be blank.": "Текстът не може да е празен.",
  "Use an http(s) URL or a same-site path.": "Използвай адрес с http(s) или път в сайта, започващ с /.",
  "Unpublish this record instead of deleting published content.": "Публикуван материал не се изтрива. Първо го свали от публикация.",
  "Confirm deletion by entering the current slug.": "Потвърди изтриването, като въведеш текущия адрес (slug).",
  "The confirmation does not match.": "Потвърждението не съвпада с адреса.",
  "This record is linked to other content. Keep it unpublished, or unlink those records first.":
    "Записът е свързан с друго съдържание. Остави го непубликуван или първо премахни връзките.",
  "Complete the required publication fields.": "Попълни задължителните полета за публикуване.",
  "Write the author's name.": "Напиши името на автора.",
  "Add the author's context.": "Добави контекст за автора.",
  "Write the work title.": "Напиши заглавието.",
  "Add a genre.": "Добави жанр.",
  "Add a summary.": "Добави резюме.",
  "Add interpretation notes.": "Добави насоки за прочит.",
  "Add at least one key theme.": "Добави поне една тема.",
  "Add at least one important idea.": "Добави поне една важна идея.",
  "Publish the author first.": "Първо публикувай автора.",
  "Fix the structured content and unsafe links.": "Поправи съдържанието и небезопасните връзки.",
  "Include an explanation paragraph and an illustrative example.": "Добави поне един обяснителен абзац и един пример.",
  "The topic hierarchy is invalid.": "Йерархията на темите е невалидна.",
  "Fix the topic hierarchy.": "Поправи йерархията на темите.",
  "Publish the topic and its ancestors first.": "Първо публикувай темата и родителските ѝ теми.",
  "A required topic is unpublished or missing.": "Нужна тема липсва или не е публикувана.",
  "Remove duplicate links.": "Премахни повтарящите се връзки.",
  "Use unique criterion identifiers.": "Критериите трябва да са различни.",
  "Use at most two decimal places.": "Използвай най-много два знака след запетаята.",
  "Select an option in this draft.": "Избери един от отговорите в тази чернова.",
  "Choose existing topics of the question's subject.": "Избери съществуващи теми от предмета на въпроса.",
  "A topic is missing or belongs to another subject.": "Тема липсва или е от друг предмет.",
  "Only literature questions can link to works.": "Само въпроси по литература се свързват с произведения.",
  "Remove work links from language questions.": "Премахни произведенията от въпроса по български език.",
  "A linked work is missing.": "Свързано произведение липсва.",
  "Choose existing works.": "Избери съществуващи произведения.",
  "Record the editor and source attribution before confirming review.": "Попълни редактора и източника, преди да потвърдиш прегледа.",
  "Review requires an editor and appropriate attribution.": "Прегледът изисква редактор и посочен източник.",
  "Publish linked works and their authors first.": "Първо публикувай свързаните произведения и авторите им.",
  "A linked work or author is unpublished.": "Свързано произведение или автор не е публикуван.",
  "Complete and review this question before publication.": "Довърши и прегледай въпроса, преди да го публикуваш.",
  "Write the question prompt.": "Напиши условието.",
  "Add the explanation students see after they answer.": "Добави обяснението, което ученикът вижда след отговора.",
  "Add reference guidance for the written response.": "Добави насоки за писмения отговор.",
  "Fix the rubric: every criterion needs an identifier and a description.": "Всеки критерий трябва да има описание.",
  "Add at least two answer options.": "Добави поне два отговора.",
  "Two options have the same text; make every option distinct.": "Два отговора са еднакви. Направи ги различни.",
  "Mark which option is the correct answer.": "Отбележи верния отговор.",
  "Add at least one accepted answer.": "Добави поне един приемлив отговор.",
  "Remove the accepted answers that are blank.": "Премахни празните приемливи отговори.",
  "Link the question to at least one topic.": "Свържи въпроса с поне една тема.",
  "Record where the question comes from: its origin, editor, and review.": "Попълни произхода, редактора и прегледа на въпроса.",
  "Record the editor who wrote or adapted the question.": "Попълни редактора на въпроса.",
  "Add the attribution that credits the source of adapted or official material.": "Посочи източника на адаптирания или официалния материал.",
  "Have an editor review the question and record the review before publishing.": "Прегледай въпроса и потвърди прегледа, преди да го публикуваш.",
};

const generalFieldHint = "Провери стойността на това поле.";

export function translateEditorialMessage(message: string): string {
  const known = translations[message];
  if (known) return known;
  return /\p{Script=Cyrillic}/u.test(message) ? message : generalFieldHint;
}

/** Collects messages for a field and its nested paths, such as "themes.0" for "themes". */
export function fieldMessages(fields: Readonly<Record<string, readonly string[]>>, name: string): string[] {
  const messages = Object.entries(fields)
    .filter(([path]) => path === name || path.startsWith(`${name}.`))
    .flatMap(([, values]) => values.map(translateEditorialMessage));
  return [...new Set(messages)];
}
