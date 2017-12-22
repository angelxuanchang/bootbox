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
| `inputType` | `text` (default), `textarea`, `email`, `select`, `checkbox`, <b>`boolean`</b>, <b>`radio`</b>, `date`, `time`, `number`, `password` |
| `inputOptions`  | Array of valid values need to be specified for `select`, `checkbox`, or `radio`. |
| `customInput` | Specifications for a custom input field (`Other`) for `select` |
| `useNumberShortcuts` | Uses number as shortcuts for `radio` options |
| `parse` | Custom object with `name` (`string`), `parse` (`function(string):T`), `toString` (`function(T):string`) that handles conversion between string and type `T` |

### Additional options

| Name      | Description |
|-----------|-------------|
| `propagateKeys=false` | By default, we now prevent key events (`keypress`, `keyup`, `keydown`) from propagating up.  Set this option to `true` to enable old behavior. |
