(function() {
    "use strict";
    var fr = window.fr;

    fr.editor = {
        keyCodes: {
            LEFT_BRACKET: 219,
            RIGHT_BRACKET: 221,
            LEFT_ARROW: 37,
            UP_ARROW: 38,
            RIGHT_ARROW: 39,
            DOWN_ARROW: 40,
            ARROWS: [37, 38, 39, 40],
            ENTER: 13
        },

        lastCharWasOpenBracket: false,

        renderedClass: "line",
        renderedSelector: ".line",
        editClass: "line-edit",
        editSelector: ".line-edit",
        linkSelector: ".link",

        init: function() {
            this.watchTextChanges();
            this.watchClicks();
            this.watchBlurs();
        },

        watchTextChanges: function() {
            var self = this;
            $(document).off("keydown").on("keydown", this.editSelector, function(e) {
                return self.handleKeyDown(e);
            });
        },

        handleKeyDown: function(e) {
            if (e.originalEvent.keyCode) {
                var key = e.originalEvent.keyCode;
                if (this.keyCodes.ENTER === key) {
                    this.handleEnterKey(e.target);
                    return false;
                }
                if (this.keyCodes.LEFT_BRACKET === key)
                    this.handleAutocomplete();
                else if (this.keyCodes.ARROWS.includes(key))
                    this.handleArrowKeys(key, e);
            }
            return true;
        },

        handleAutocomplete: function() {
            if (this.lastCharWasOpenBracket) {
                fr.autocomplete.toggleLinkDialog(true);
                this.lastCharWasOpenBracket = false;
            } else {
                fr.autocomplete.toggleLinkDialog(false);
                this.lastCharWasOpenBracket = true;
            }
        },

        handleEnterKey: function(node) {
            var $newLineTextArea = this.createNewEditor()
                .appendTo($(node).parent())
                .focus()
                .textareaAutoSize();
        },

        handleArrowKeys: function(key, e) {
            var self = this;
            var node = e.target;
            var startingCaretPos = node.selectionEnd;
            setTimeout(function() {
                var endingCaretPos = node.selectionEnd;
                switch (key) {
                    case self.keyCodes.UP_ARROW:
                        if (0 === endingCaretPos) {
                            // Move up to the previous node if there is one, maintain current caret position
                            var $prevNode = $(node).prev(self.renderedSelector);
                            if ($prevNode.length) {
                                var startingCaretLeftCoordinate = getCaretCoordinates(node, startingCaretPos).left;
                                var editorLines = fr.utils.getWrappedLines($prevNode);
                                var lineToFocus = editorLines[editorLines.length - 1];
                                var caretPosition = Math.min(startingCaretPos, lineToFocus.length);
                                self.switchToEditor($prevNode[0], caretPosition, startingCaretLeftCoordinate);
                            }
                        }
                        break;
                    case self.keyCodes.DOWN_ARROW:
                        if ($(node).val().trim().length === endingCaretPos) {
                            // Move down if possible, maintain current caret position
                            var $nextNode = $(node).next(self.renderedSelector);
                            if ($nextNode.length) {
                                var startingCaretLeftCoordinate = getCaretCoordinates(node, startingCaretPos).left;
                                var editorLines = fr.utils.getWrappedLines($nextNode);
                                var lineToFocus = editorLines[0];
                                var caretPosition = Math.min(startingCaretPos, lineToFocus.length - 1);
                                self.switchToEditor($nextNode[0], caretPosition, startingCaretLeftCoordinate);
                            }
                        }
                        break;
                    case self.keyCodes.RIGHT_ARROW:
                        if ($(node).val().trim().length === startingCaretPos) {
                            // Move down if possible, move caret to beginning
                            var $nextNode = $(node).next(self.renderedSelector);
                            if ($nextNode.length) {
                                self.switchToEditor($nextNode[0], 0);
                            }
                        }
                        break;
                    case self.keyCodes.LEFT_ARROW:
                        if (0 === startingCaretPos) {
                            // Move up if possible, move to caret to end
                            var $prevNode = $(node).prev(self.renderedSelector);
                            if ($prevNode.length) {
                                self.switchToEditor($prevNode[0], $prevNode.text().trim().length);
                            }
                        }
                        break;
                    default:
                        break;
                }
            }, 0);

        },

        watchClicks: function() {
            this.watchFocusClicks();
            this.watchLinkClicks();
        },

        createNewEditor: function() {
            return $("<textarea/>")
                .addClass(this.editClass)
                .css("min-height", 24);
        },

        switchToEditor: function(nodeToEdit, caretPosition, previousCaretLeftCoordinate) {
            var self = this;
            var height = $(nodeToEdit).height();
            var $textArea = this.createNewEditor()
                .replaceAll($(nodeToEdit));

            var value = fr.parser.parseLinkOnFocus(nodeToEdit.innerHTML.trim());
            $textArea.val(value);

            setTimeout(function() {
                $textArea.focus();
                $textArea.textareaAutoSize();
                $textArea.height(height);

                caretPosition = undefined !== caretPosition ? caretPosition : $textArea.val().trim().length;
                if (previousCaretLeftCoordinate) {
                    var newCaretLeftCoordinate = getCaretCoordinates($textArea[0], caretPosition).left;
                    var caretOffset = this.findClosestCaretOffsetMatch(previousCaretLeftCoordinate, caretPosition, newCaretLeftCoordinate, $textArea[0]);
                    caretPosition += caretOffset;
                }
                $textArea[0].setSelectionRange(caretPosition, caretPosition);
            }.bind(this), 0);
        },

        findClosestCaretOffsetMatch: function(previousCaretLeftCoordinate, newCaretPosition, newCaretLeftCoordinate, node) {
            var diff = Math.abs(previousCaretLeftCoordinate - newCaretLeftCoordinate);
            if (0 === diff) {
                return 0;
            }
            var onePositionToTheLeft = getCaretCoordinates(node, newCaretPosition - 1).left;
            var leftDiff = Math.abs(previousCaretLeftCoordinate - onePositionToTheLeft);
            var onePositionToTheRight = getCaretCoordinates(node, newCaretPosition + 1).left;
            var rightDiff = Math.abs(previousCaretLeftCoordinate - onePositionToTheRight);
            if (leftDiff < rightDiff && leftDiff < diff) {
                return -1;
            } else if (rightDiff < leftDiff && rightDiff < diff) {
                return 1;
            }
            return 0;
        },

        switchToRendered: function(nodeToRender) {
            var plainText = $(nodeToRender).val();
            var parsedHtml = fr.parser.linkBracketedText(plainText);
            $(nodeToRender).replaceWith(`<div class='${this.renderedClass}'>` + parsedHtml + "</div>")
            fr.page.save();
        },

        watchFocusClicks: function() {
            var self = this;
            $(document).on("mousedown", this.renderedSelector, function(e) {
               self.switchToEditor(e.target);
            });
        },

        watchLinkClicks: function() {
            $(document).on("mousedown", this.linkSelector, function(e) {
                e.stopImmediatePropagation();
                var pageTitle = $(this).text().replace("[[", '').replace("]]", '');
                fr.page.load(pageTitle);
            });
        },

        watchBlurs: function() {
            var self = this;
            $(document).on("blur", this.editSelector, function(e) {
                self.switchToRendered(e.target);
            });
        }
    };
})();