# Everything else

You can imagine badtimelang as a wrapper around the raw csv files. Certain things are abtracted away (JMP statements, labels, variables) but otherwise you can use any statement from the original format.

For example, to use [`SansText`](https://github.com/Jcw87/c2-sans-fight/blob/master/Documentation/Sans.md) you would have to first convert it to camelCase `SansText` => `sansText`. Then you can use it like you would in the csv file.

```
sansText hi
sansText "among us"
```