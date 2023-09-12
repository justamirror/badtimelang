# If and while

If and while, both function similarly.

Here is an example if statement:

```
if a < 0
  sansText "hi"
end
```

You could change this into a while statement by just replacing the `if`.

```
while a < 0
  sansText "hi"
end
```

...Adding a decrement to make sure this ends...

```
while a < 0
  sansText "hi"
  set a to $a - 1
end
```

And presto, you got a loop!