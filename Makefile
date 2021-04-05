PACKAGE=netspeed

GETTEXT_PACKAGE = $(PACKAGE)
UUID = netspeed@hedayaty.gmail.com

LANGUAGES=ca de en_CA fa fr it pt_BR ru zh_CN zh_TW es_ES nl_NL ru tr zh_CN
DOC_FILES=CHANGELOG README.md
SRC_FILES=extension.js prefs.js net_speed_layout_menu_item.js net_speed.js net_speed_status_icon.js lib.js
MO_FILES=$(foreach LANGUAGE, $(LANGUAGES), locale/$(LANGUAGE)/LC_MESSAGES/$(GETTEXT_PACKAGE).mo)
SCHEMA_FILES=schemas/gschemas.compiled schemas/org.gnome.shell.extensions.netspeed.gschema.xml
EXTENSION_FILES=stylesheet.css metadata.json
OUTPUT=$(DOC_FILES) $(SRC_FILES) $(MO_FILES) $(SCHEMA_FILES) $(EXTENSION_FILES)
POT_FILE=po/$(GETTEXT_PACKAGE).pot
LOCAL_INSTALL=~/.local/share/gnome-shell/extensions/$(UUID)
pack: $(OUTPUT)
	zip $(UUID).zip $(OUTPUT)

$(POT_FILE): $(SRC_FILES)
	mkdir -p po
	xgettext -d $(GETTEXT_PACKAGE) -o $@ $(SRC_FILES) --from-code=UTF-8

update-po: $(POT_FILE)
	for lang in $(LANGUAGES); do \
		msgmerge -U po/$$lang.po $(POT_FILE); \
	done

locale/%/LC_MESSAGES/netspeed.mo: po/%.po
	mkdir -p `dirname $@`
	msgfmt $< -o $@

schemas/gschemas.compiled: schemas/org.gnome.shell.extensions.netspeed.gschema.xml
	glib-compile-schemas  schemas

install: pack
	mkdir -p $(LOCAL_INSTALL)
	rm -rf $(LOCAL_INSTALL)
	unzip $(UUID).zip -d $(LOCAL_INSTALL)

enable:
	gnome-extensions enable $(UUID)

disable:
	gnome-extensions disable $(UUID)

reload:
	gnome-extensions reset $(UUID)
