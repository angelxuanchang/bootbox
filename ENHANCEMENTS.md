This is a enhanced version of bootbox.  Please see http://bootboxjs.com for full usage instructions for the original version of bootbox.

## Enhancements

### Form support
The main enhancement is support for a form with multiple inputs.  This is a generalization of the `bootbox.prompt`.
```javascript
      bootbox.form({
        title: 'Form title',
        inputs: [{
            "title":  "Prompt displayed to user",
            "name": "Name of field",
            "inputType": "number",
            "inputOptions": [{ text: "none", value: 0}],
            "value": 0
        }],
        callback: function(results) {
          if (results) {
            // Array of responses (one per question)
          }
        }
      });
    };
```

### Enhanced input types

| Name      | Description |
|-----------|-------------|
| inputType | `text` (default), `textarea`, `email`, `select`, `checkbox`, <b>`boolean`</b>, <b>`radio`</b>, `date`, `time`, `number`, `password` |
| inputOptions  | qux      |
