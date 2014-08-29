
# OS X Sublime Text 2 hack
PATH := $(PATH):/usr/local/bin

COFFEE = PATH=$(PATH) coffee
LESS = PATH=$(PATH) lessc

AVISPA_JS_OUT = dist/avispa.js
AVISPA_JS_SRC = src/avispa.litcoffee

EXAMPLE_JS_OUT = example/example.js
EXAMPLE_JS_SRC = src/example.litcoffee

AVISPA_CSS_OUT = dist/avispa.css
AVISPA_CSS_SRC = src/avispa.less

all: $(AVISPA_JS_OUT) $(AVISPA_CSS_OUT) $(EXAMPLE_JS_OUT)

$(AVISPA_JS_OUT): $(AVISPA_JS_SRC)
	$(COFFEE) -o `dirname $(AVISPA_JS_OUT)` -m -c $(AVISPA_JS_SRC)

$(AVISPA_CSS_OUT): $(AVISPA_CSS_SRC)
	$(LESS) -x --no-color $< $@

$(EXAMPLE_JS_OUT): $(EXAMPLE_JS_SRC)
	$(COFFEE) -o `dirname $(EXAMPLE_JS_OUT)` -m -c $(EXAMPLE_JS_SRC)

clean:
	@rm -f $(AVISPA_JS_OUT) $(AVISPA_CSS_OUT) $(EXAMPLE_JS_OUT)
