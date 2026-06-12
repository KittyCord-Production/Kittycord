/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * Cat sprite sheet based on oneko.js (https://github.com/adryd325/oneko.js),
 * recolored to the Kittycord palette and embedded as a data URI.
 */

export const SPRITE_SIZE = 32;

export const SHEET = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAACACAYAAADktbcKAAAQAElEQVR4AezdS7IkzREVYElLYQWMgQUxYMxKGLAhGLMCtgL2/WZH5u0dERn5qLp1+78yO+av48c9IrOyWz2Q/vWPjf/8p//wH/8fhFp9ucTdqv3ge96AZwnfc/ufrXdv4PAD4CX4X//1f/wD+LvCP7zvfwM/z/z7P8OjExx+AGYCPgbBiLOqjfizXHRmdtb3k3/mBn4+As/c41Mq+R08pbf9AfjP//O//TXTAhwvRkXysf/7//6ffwLuVdCqM/jRio+T3He09g9eub8ZV/Xd9Z3+q3N/+sY3kOdx95lQ3/4AGKqBBX6FHNTcHd/h6PnwBPTkoPq4HerfBc4DzvCKnVe6q1rdJfvt8mvv0/67dzAPnj7HHT3PA+7utf0B8CM00NJ8tiI5HLizWO2lFfR5feaIV3u+g1/P/sS+9NzLrhY+jHrkQH1X72me2V+xQ2aa//SZ7uhlr6saWx8APzSDrg7Z7XO5MPuvDvYIZvuoz/p393gnz652NtOZwB2I74IOvV2d8I961HF3dc/ydrRfvcNoZzPBfjDiPJGjHezo3dlp6wOws8QTHD8GWGk5LKw4363mzPkI2N35vAD8q9BPZ7e/8usuu/1P8bIHe6TpfDu8I52zdXPhlbPpgxlB9hw9H1zADW9lU9v6ABBOA9vjUQ5ndxm8Cnoj0Bzlk3MxfkyJv5O1t/2zs7O6k8S7Vg/o7z3yPfepsf37vmL5urNYvube5Wf2K+ebEWSOeHZGtfBmnJpffgAi5MWsqALVrxy+WjT4K1gccNITDbmvgl1GeMU+s4+A+Tvz8NwhdL4c4PSanFrPf3VsJ7sd7bHLW+mYU7Hi1prZoFeeBf5V9PcgOuZAYnb0G8HZ3WH5ATCAWIf8CCOew4y4PZeDRKPXRzFu8vrFuwdP35GlWYEvZivMrai1O75ZcKStvprjftSjxZ8BR00P8L8KdnE24M/2UMOZ1XfyNAJawW4vPi6N+OJXwqw7z2j5AfDjJR7kIOL47CiW069+hPD0hOtgfDng70Dfk5f/z//+X/4JdgD64r6LPMjH8p8CzcD5oGur99xO7P6dLVw+0IPkY1OzQ0c4T1o7wJOaXavfgXkVnf9JsT2zj2cTf2ZrfvkBCDEDiEPiWpcPej28lfUA1GmwQCcQz6AHL3W+FzMxP0juiqU7+vHTks8efLmzM/HN0LsCDuDjsWL+E6AFM63U2A67wKz3KO89cI9HvFHdLndmjzRHuav7jbTO5I7mqruDM5pbH4AIE4fRAPkg9bMPw8PXax47QmrVmtu5cuYDHzpnJ9YPuGbyQVyRXOVcnVl1Vz79zF3x1HBZ4Pc+d293dbZCbhe0oevv9p/h2fEM/4hb72DGNdP5ZvWav3MHo13MNb/OqLF6re34hx8AixAyKBCPkDqrnl7+LvRANHpfDtlt54nD4V8FjRHo1QdcOWrvQub2ee6votdHcb336LIjbrRHNTl99X7knkJmm/GUZnTqHSQXa+7uTDx4+g5oZh82sd0qnEP9CIcfgAgYFCTXbepsr52NHSAHOtsbvv7swqeZ2q711/kR8mBjK4d25rLhyL8L5las5tovSM+K7y53eDh0V1pna6vZalee8dkd8M0C/gp37sBZ6gx+UGfKmRPUWvd7fPgB8AAJ98ajWI/eI96q7gLAAVe83drdffQHZjojm1ysXIdaz31V7D7da+Y7R5DczOrFndV7Hnd0djno/MTmBMmx9FgY1WmOgH8G0WbTl9lyfEhtZfHstOLMap6Teep0AnEgF46ceHfe8gNAhBjRK9BL40pv7amXUPMr34WYj1N98Vk4A9AD/SPbc3iBGo3E3arh9PwTsfNXuM/o8mut+uHEqj2x485ZzQkyP9YeMKsnX62Z6d+xtbfz1XrOPu5Sns9W6Dm7Q/rp0uxIPbbWkzuyyw/AUfM767mE3ZkuvHPlPATotVmMqw9mHLVcPr/z5NRZer1+Jqazy8cFd1cx6rcb1JpeqLkrPt2cmxUf6Zgb4PJZSL9cRa3xK/SYXXMrv+uKV/zU3HP8Jy3dipG2Mwaj+ij3bT4AlncBuw8CP3Ap1RfvvAw4uOllze85eTngj6Cmt9fMAPVeq7FeOOLVnl0/90qfX0FDHvh3sHNO+uazkPPGytVd5CvU72Jnft3BPDs4H4hfCTPMy4y+S/LdjuLfPgDEYUS+k6MJdzR2e+9cyO6MJ3n1YVZd5whwoNaP/PB37t1LD11TDnr+bGwXSJ9zrXTVAK+DDtBSY4MeJ3/Wmg30OsyGrplcbK8/EXuWXV8MV/R/+QBUcT5Bh2evIL20LAj8K1pneszJ7DN97+LO7sDOFc4B9kqeP8OIk/7ZzJlWz/sxyJnB3gGN6B3p4AW4OU98Mb0gsfoTyGyWHn12BnW7zOp38p4h/ZWG2ZB9V1y1Xz4AEmBIICbInkF6qs6Z/rtcc7PDFa2dy97VrXvYa9QXTq3LgYcJ+sQzqOtX5wdy4EzJXbF1h/SbBYlHVr0iOiNuz9kZer7GzhbU/BO+2fCE1hUNs+Go1/3iuAcW9AF/hl8+AB5MhNJAEBLvWj1Q+bTNqLmzvn46u324Qe2x29HlVH58ffTEbCAeQV3PqJYcDh+P74wValBz3VcH/dHhywXyV86sJ4gWbRDTZUfAme064tecmbSBX2vx6cd/2pppNvBH+rvzd3l1hplmA7/W4tMFnORYfDngy43wywcAwcMiGMgFycUe5dXDZWnLvRNmBnZ4crbLDWhD1Rer11z8PJTsJo8v5p+FvoCOucCH6MlldnIri6snHH4gx2crzAvsVGu7/miuXrrsDLO6/Jldnp5v31fN789ADGYC33n4Hb99ABAsGri4IDkWr0IuCJ9Njq38Oz4t2mc1rvb1OS60z5eDmhenV14cm3ys3SDxHUvHHOADPxDf0U+v88SPNYN+kPwTdjRvpLvLG/Wucru6nZc7WWnv1LruTk/l+AgEyQ8/ACmyeZCseASLEU4NN0juaUvfxXY8PWem58xm97q8XGosyLNq74D7gcziB8ntWD11b/4KO5q7nMzZ5Xde+lk172iF3Ar6YMVZ1fQCTp0bX34FvbDipDbjyQOedzCwg9zhBwBphP5iEI7oiP+KnB06ctjZPPwjjt4dnjPTGoGGPA7w5fjsd4K7OIO7Z8t75K5gppc7jQ1PDGL9M2QOXkXy6au16mdGbGpiEEdjZDMHryL59NRa9TODxa21+PIgxgs8T7nLHwDNRAjyvxN29w7PGTtyXpdbkfzI4snTYn+wvgH31KEjOb5nxNacOEh+ZNMbbrejHpzk+dGoOfkg+ZFNb7jdjnpwkudHI7mZxQV84MOtDwABYhnKl/sOsCsc7YrToSdn7lYtfH7q3ceR+8HvN+BudqF7l9t5ekfovFWsf1Vf1fSOsOrpNf09t4rxK25/AIhlIP/vgJx3ZnMHs7p8OD/25wa+8gYe+QB85QH6bD+u/KnL7/Wf+OcG/k43cHTWrQ9A/lGi24gnL+YD/x0wK8g8P3xI/GPP30C/0/MKPx3f4Qa2PgC7B/HS+Icu4O/2zXg0jmAWzDR+8tdvwL26/+sKP53vugHPCc7OW34ACMJIVD4Y1e/maHsBK7qmWs/9xM/egDv2LJ5V/bPV3FfwjpOa5TkB/8zM5QfAX6OBYIRjDatIPv/9u/bwz2CkRTfzaPHZV8EOM7xq5o5u3WmHf8SJ3ornrvFWnFfXzJ/h1bN39Otu7iuo+R2dsxz6Zo36dnLLD0AVyBAWao0vB90XH8EhAC+WVpAfv/q7kNnVmi1m3w33AuYHYnhil+iwYEbVFctDzT/l0+2Itrz5I+CoA/9dMK/C3OzHD5Jj8ZN/wtKjGy2/k/yBndyR3f4AEM8wfhdODid+58xiS4MD4dBggVaN5d6B/K/8ms9n7cF/x/zMcCdgNiTPikEd5O6ABj0Y6cgD3qh+NUePboc8Te+G+w/kKtIXfq29wjcnM6s1KzuOrHPgvALmXdE//AA4rIUdlN0BroV2uJUzOgCtynm3b747YL/ix28urM6tDvZc8Y5qNI446nh3Z9EJPHfvS5B8nYMDqbH4OPF7Xf5pOHdmjrTVIDU7BcndseYHXSd5ttdm8eEHYNb4lfl6wa/eIy8ZO5rlsjtGvHfk3Itd7s6anfWu7qo/PxK2zs+ZnAvEdHCqL/dq1PlHs+wGeuCIv1OnQ7MifTXHx01tZbc+AASrSI/Veq7HOK+Cl4G2Qwfiu6DlHP7kZ0d68oE6n72LzD6rY77eWZ8a1LqeGn+abz+wl2cNNeZDPxf+GeiH2iMOzKi1HT89NHb4M47+aM04NY+rp+ZG/vIDEAEXXjESkqscvlw0+DvofwIc9ZjjsB3mBkcao7peefr8WL584OMA6nbgp3bVmkHrav+s70jXGWa9n5B3J0H2EVffGRNfsfS6hhytq/eTfhpXYJ8rGnr0rmYuPwBpJFSRfLeVw1f3g2Zfhczp+vLB0SX0XnF6R1Y9oA1iL0h88RXoN/NKb3r000nMB/nkulUDZ+i17xQ7g7PamQX+GVSN9MnFX9mn78/+u7NHe+mlMarJLT8A+fE6FGiA6s9inPTjnIE+/XCmb8Y9uoRRnz/JZ6h82h21fsb3oGjp2Tn7EYce0IToul/+CHhAG0YceRzaHSP+V+TsZcfRbDUY1ZLT2zlyzh5Ot2o4PX81Nr/rmbHSU1/Ve235AQg5SxCHxLUuH/R6eGeslxRonumbce3kQmf1q/nRR6Jq7c7Es2PtPTo7/ogjpxZUzZGP3/OrXjV8tsM5QP0rYa/Mzz4s1Fo4I4sHtSYe3ZecWuU+7WcGO9KWtwM7qo9yWx8AgoSDkVBqbOouO/7f0Tq/+2BX51fHC8d9+/glPmur1k6vWWbCDn/FMRucacVb1bLPijOrOYP5qce3Dx9Su2ppmHO1f6fPvjPeaL595Gc9M73DD4CHQdSAQDxC6qx6evmfABc0u4ir+8305M07q+vuztybGXp25+DbLfzMiqUFqc8sDszqfc6MN8vbZ6Xf+3DB3F4b5TrnlbG9nGdnhmcDdga9+lgx/wh4+HisGOiCfHD4AQiRQJBct6mzvfYpsd36JVzdjc5IL/kd3cr1sPKi1PyOzg6HPt5oZ/nM5ofL71CjAb1WY3XnqLkzvn3MOurBMQuOuOr4tPmBPdOvnjzbY7lXIDtkDzOqLw7ksxcrVuuoeT6YE97hBwBZUxp2rR69u/wVzwF7XQ56/l2xszlj5omD5KpVq3H3nSUvJW7V7txXxnaA2Qx7ntkN13lmekd5u5gJR9xV3R6r+qfUnHOE2f64o93x1Uao/OUHwIMjVBvO+HppnOnpXC9AzzkUbei1V8bOEtTZ8butu6jprbn4zlPPyZdLfWXxaFeOXFDzd32afdZdzZ1+9wHm7/DPcDwT2O2xA+DH8t1LjeXOwhlHmOmYGcw4Iz258JcfgJA+yd695Ctn8YLA6rLVZrulxtKpO3gYUHN8qA4QLwAAEABJREFUuZme+gx6zAEcMfCT40PfRS7I/PQmf8Wau5q1q5mdOp9+z+3GNKHyu16N+RW17zv63+4D4PLvXPTZF9qLayaYqz++uEIeai6+vN7Edy0t6LriaPOD5GLl489sfhjmwIy3m3eXu9wzPLsFtU9uFc/26X1V45P9K7v99gFwKXBFbNVDE1acWc2L+Hd6KPUe6rn5AY4fsZgVn4E+93rUgwNHvKO6HeHqOxB9u9g9MUs36DX1EexBa1SjNcqPcnWevhrji2dz1K+A5qhvlh9xk/vlA+BSHEKRz14R1QfppUUX+Gp3Ee2zOnbY7bHrGf4Z3V1u59kncAf8zhGrAb9D/spLaZberncmpuFez/SsuH0f+it+av384mixEG63q1rl4tGtuU/zf/kAZDmXGMg5CHsG6ak6Z/o710XSBJrqfHYENUit+nJHL6F65uDfRebvamY+fu3lB2p9r9Tk650lz8qrn4EevWay6eVD4pFVh9RoOF/isza76KNVteUCtfhsj+Uqqq483RGqDh8nfDH/q5Gdjvb45QPQL0CzAwH/DPRA7bGUGTV3xk8vnWjzZxo46oATKy++Ar3RYWGlow76VrxZTW+v0YKax4Pkc1dsR+3b8f1YAdeM2PiZKd+BY748nwU90RSfBc3o0eLDTCe12BmPboBDu0JuB+bQ2eEecejQC88+8ZMX17x4B798ADRkGGGQC8QVR3n1yqct9zTMmGnmUjI7XPk7L6B5NIBmIB/IqUNysTuz9dsb+Onld5gB8vjh3rX2pBsdfiDHZyvsEGQXFpJnxbXvrK+fjj57gLhCDVLj62OPgEer8qpO8qNcak/avgtts9kKvFG+cuL/9gFQcPCAWJAci1chF4TPJsdW/l2ftkMG0ZMHMQt8eGoHM6uuOOh5c0EeJ1ZuBbtC5egVywdiuqy6PP8dyNw6KzvYA2qNLxeI74KWmdGxEyRWC2o+9SPb9WnpYYEfRF9eX/JPWZq0g6qbHJs9an3mDz8AlWxokHz/UyH52PDZ5J60DgjRdOhAztwOeZAPly93BebT6b3ycqmxIM+qXcFqV7qw4lyZqYcmbT7wV8B5N/qOmS8PYvcf6/3l74JGzswP9CfPBzH7SphP36xAnDx/F4cfgC7k8nKZaha4MljvVZhZQccOgXiFHR6OGSsd94Azgj55HODL8dkrsBPUXnFQ80/60d+1T85+Qsveuf+rejSg9osD+cyQE78a5gBcnXX6A1AHOfCd4VVr1zdvhN3+MzxznHGE6PhBVyQ/snjy9NgfPHcDeVbPKZ5TMj841/k8+8z7dfoD4JAGAP/59T9L0Rk7bOj8I6iFzw+n+zhyP3juBtxpve+qXGv8WvvTfOdzD+zR2U5/AAgSBv7fEc6+Qu5khxPuj33mBuqdd8XUev47xHZ/xZ6XPgCvWORH8+cGfm7g+AbyIYhNR+JuU5/Zb/sB8I+RFbMDfnU+O371Hj/z/7wbeOLd+ugPQA44sv5BrWLESe6rHr35dvyq+T9zX3cDni28bsJa2WzvFvDX7Hn19gfA8BXmo9cVmg4XVnwWko+VA3FsfFr8d8LMusc7Z/9Js9xj8Cnnso9nC/xP2evKHrc+ADm8i8hwfkU4qZ+1tPT4V83qy1Woi3GqL/duOLM9XjGX9kr3qL7qTe0JjWiNLP3gqO4eg/Swo75X58wF+2QWXy7xO+0Ts7Y/AA7Z4fBgERb4foCBnD75O6Cz23+Gu6u5w3NO2J2Pu6MbDj5tNrlq5Vf1yj3yaR1xrtTp2hFG/bXeOWLQh1ch92r4BzbwbtdZdrJLzX0Xf/sD4EAOWiHnMoAfdI78d70gu+/A+XLuzpdXh167Ekev9tKWr7k7Pi2adzR6Lz26PV/j/MC8UyPg0uigrfYOZMd3zHr1jO0PwOrQHkZ9WKOlcTwkGNVnObp6a73Haj0n1qv2ajiTeas56oC74s1q+vTP6jWPh19zV/yndMy2Dz0+eDbeKX6HPNS8Xqi56quZUXNP+/SDkXZq7Kh+N0c36FrJs722irc/ACsRNQ8A+DOow6w+y3tZKu7yZv2vzNufvvOffUj6OqoOPXHnPBHTpX9HSz+daLiL/gNPLVYPXx/wj4CXviPu2Tpd+hVVo+b5+LV+16dHN2Cjya/ATe3InvoAeGge3krUIrO6XrAgzHg9T7Oi1xNXDj/5727d1ew8aqPz4c9qI35yo55ojWrpm1k9+lP3/L1HiUdWj3ztE+9Aj/6g9oxytT7z9dGd1Ud5fH2j2tkcHXq7fbh6dvinPgA7gp3jgcvFWg7kdoCb3vCPYjwcvfxPg712H1Dd3ZkCeTqBODVWfBZ2qnq1P3mcmp/5eKAvHHsd/fjDrX3J7Vgz8Hp/3wVnB1f7aNtBP/8q9NM5269H71HfqQ8AQcK5ZOJi9gh4gFf7xSN4USqPH0QnfeLUYlMT00r8Tms2mGlH9g5oBNGtNjX27Jw8W33R5I+AO8urgR1gxLuaO9orun1u9kl9117tq/p2oVNzu74+/bv8ztNLo+drvP0BIESwNq98Dwtwal9yZ36U6WeBZod8oMZnn4Z76DAr56rz5EENUuPLJz5j9eLrj5+YrTnx0zC3a+Y+1ILOeSKmvTqfGk6dZbeeq/WzvhmrnqP6qnenRn/F63Vndweznt8+AMhBmsSEEvP7oNRicYLk0nPmx59eWvqD5GOTZ3GTf8q6A6DdYYYcO4IajGq7OeeC6MQX86OTuOZSe8qa4S7osWIQr4CDv+Ic1WiMzianVvvFUHN3/MxgRzry5rGj+t0c3ZX+UX00/7cPAJIh4GEBX75CzkC5buU6wrny44+WmUFyscmzyT1lcwdntZ25wj7iszr69AD/CHhwxEs950u829v70v9ue/VOV3s626zufsysdbF8zVV/pVd58fFnevLmhcuK5fkd8vR6Xjz8ACgEmuN3m1q3nWc5P3zotVWMr3fFWdX00lhxjmouLucbcc2AUU1foI4n5n867FrR93UO6PknYs/M7Ce0zmp43uBskD1Y8Y4eHj4uKwa6IH8W0dnpMwt/h/vbB6Be/hmh0TBLAM1R/UyODhz14MARb6fuYbmDFVcdjmbiAF6w0q0196en5o58fH1HvFndrhUz3qfmnb/ultiZPNdaiy+vDslVPzlWPpqsWL6j5vlgTuftxuHRMVfMivln8dsH4InlLGEpLyCI74CWA0LVkYeaw4Ger5zqOy/UHF+ODn8HuDsz8YId3XDcY9WnIQZ+eKwcPn8HuHp2uH86xz2M0O8494Abv1p8tREqb8enQW/EVRvl8We1yv/tA6BYm6uvtgODvVQ73B2OHTrPDHng97p8z81iXD/4WX03T2e0i9wIZ+8Iv+qYB/areTy5M9BTNfhn+ne59r1z1/aikXliPgv8HdgBKtcdjFA51bdHUPPVH+nJVc5VP7PZqxr//gC4DBiJjXKzgR7CUwec7TOb3fP2ptHzo7hy9YhHvDM5dwG1hy7U3Bnf3cKoRx5GtZ2c3gq7Vxxp4B5xnq67y4roy8Vne5xzqn0avH+v2Gmk+9cHQMEFQQZXP7kj6wVwsUe8T607s7u4u597ADruo0Ie5NSvwI52rb1i+Zp7wqcbHOnhORusuHh2hRXvydrRTk/OuquVd6PvfFU3OtGtOn99AGpi5kdkVv+ueZdSz+blhLvnoQtdRw56fjf2o5ntJ6++q7XiXdWxA7jTYDQHZ5RPzh3pT8yKa59Yfge1b4e/4szmzvIrrVHN3dsXRpqjHJ1RXo4O0MWr2PoARKQ2/kn+6GW7cj73pI8e+zQ8QA9ypauOt+Ic1dJPq3KdD2qu+mqBvH5ILlZtB+5Rzw53xVMDOixd/qfDrk/suNI5/ABo9hCfWOSTNbwUzlqx2je8cMR8OuxT8GOEK3r64EwvvucNtc/5kuOP4OwV4URHP8gnd8bWXhri9PPlRsCxlxorPgu9Z3vu8DPPue7opD96XetfeeC1gBzU/MrHv3q5K91ZLQdTr774Kuxf4UwzrczEgfDcZ5DcVUvHHOCPdOrsWsfXB/xam/l4+LVOH+TZ1Oo9xU8tNvnY9Het8EdWb/pG9Z6j3REOrfh3LP301916/uo8fZAZdFdzKi8+vr7E9CBx7G9/A9CIGIT4adaeFa/Yzx2sZuSC2cAefNYPir0CvdHRH98+4hlSDx+PT48/gzpe6nRADvjuIwjvjNVLB/hwpj9c/XZKzM5y8lfn0A3Mo5U4Vj5+7IiX2hlrb1qgL5YfrObjA53wu/3lA3BE7s2Jr/alf2YtTntVx5nV9a7qs76a1x/QqzX+6AHIvwK7s3Z5dUdndL5ADDWu/Ks+TTjTj28PPf1s8qAWG18fiJ+A2WYEVTM59smZtCCz6AfJscmxYtAH/Bl++QDMSDVvQMfRkNr/hG9+ncmXe0L7SMOcFfSrs/Zir4IOXO3Xpx/4/pSvkKuwb5B8j5P/CptzmM0HfnZk5YCv9gpE25zAnOT5T4N2Bf3MZsW1zpc7wr8/AESOmsLBqzga8mQ9O3RN+6j1/JOxGWdwdbYfqV5/4gB/hJw3dsTRD2psReaofTrcux1zVnEgH4xyqT1tM4t9WrvqjXwzO0a8o9xfHwCXSuyI/NX1oz2dAeer93xqvrN00E6O78xszcWvtnKST6/ad4B9g6/Y1719xdxXzvzXV17ozsHs5+KBf9SDgwv8I/4n1u29C/vvcjtP7w+Ob8C9fef3aXXCv/4GsCJ8Qs0DgN1dcGGX/8P7uYGnb+C7vH+HHwAH8fUD/tMX9aP3cwPf4Qby7neb3Wf51K/aV/cdfgAs4HDAB/94FIi/Apkf+xU77Mz89P12zvDD+cc/Rs9xlHNXs7zap2HrAzBaOv+anMOu7Kj/TG6knfmxI86ZGa/g2sl+r9D+0XzfDdTnyDeZ9WyBLwfxe17tE3H5A5DDOGj8WLmKXErqZ62/fYC+6PIrah4Xav3dvjPb6d1zf+a97gZ2n+cub7apd2dWu5qfad7+AFgoB2bBvxfIs8CfLaB2BL1AGzea/CA5HFxI7d3WbHus5uLAijOqHfUc1Uead3NmBne1zvRn5sie0fk0rj+8nGm01ywf7qguRzOcah/5AFRBvpffD5IN5C0SG1+8Azo7PJwzXPyn4EzQ54vlwaxY/hnoi9ao76g+6rmTMw/sFIjhju5RL33Ay9xuU8fhd8jvQB/tcPlyiauVV0+OL5f4jPWD7b3ileaoLkdrNvslHwDDLOojwAcxm4VWS+F9NziXM8Jod3nAG9XP5EY6dOXP6FzlmgXmQdURgzrU2hM+TfrQ9bxvQd6vytcTyPf+OzE92nc0eq8z0O15c3peLN+5NHquxi/7ABhyZSF9FaODjXR7Tqy3ar3KN8e8Hf1dXtc6OwO/azwR03UGWOmpA/6Kd7bmhfYj10c/vhjUgW82Dh9wg3Dkz4ImpI8Pic9ae8KoL3uq787Awx/pyakB/7EPgKEEX4E8tNjZjM9GXSEAAAftSURBVNRjZ7yvyNvpybnuOw+RFT+pP9J615zR7J7LfTp39e0YqKUPx48pSP4TbHbK3nY6grPh47Fi/gp4kHm42x8AjYFGF8q+Aw5XMZtZOfwZ7xPyZ/Zz7zO+2ug8+LPaiI8Lo5qcGk3+GejRe6ZnxaVFE/IOxq+x3ErnE2v5YTojZEf+7Dxq4VWLnxoL0a+85QdAU0CwIxdeBWc+rgVm9Vlej95aP4pxcfTyPwn2emqf+jye0KTneT+hVTWe0rUbrWh3Xwypf1frvYWj/Z01WHFpwYgz/QDkslcD1Eair8j54QR9rji12FfscFfTbnaFO1p0Rv2z/Ig7y9nNs4dw+PKJr1j9dHZ7cSH86if3DuuHc/Ve9el/ek+6I81ZfsRNbvgBcNkeWEh3rKXgiYuwE4z2kQ9G9ady7qbDXGcczZAHHBhxPiHn+djTLvaEnFNuhvTM6vLhRFOuYjYnfHV8MfuVyFlmOxzVe5+zVai/CnUO35zfPgAKT120y/BigWFnYRdIH70gudjk2eT0QuI7lg64mw66cmyHPPR83bPXPiW2dzDaV059tS9OreO7x5rjJ99r8oDzFbBP5jsLnx3tIl/rfP0jbnJ+GxXJv8LWOXwzfvsASH4CcnEuEezEBuKK5Fl5FvjR4l+Bflpwpb/2eEkgD6DWdv3ZHrP8ru6Kd0fbWZ05+rTcaeJYef6sVjXwdqHPDrv8I549aVaeWL7mXuXP5szyqz1++QC4+CsiqwF3atnl7OXq02M2n72KozsxB470cQAvL2Os3A70B+GLqy+G5Hbt0Tm7jhln7tZZ9XSdHkczttblaEDNr3xcs1ecnRod83e4ePg73DMcmkH6xNUXQ3JH9t8fgLMvwJHwn1DfuRMPG1aXXmtXXkY9NMwJcr/i6osBX19qK1vPqW/FPVuzC3199on+LI+nxo6gBtEZcZLDMTPxk7buYI74Cf2RhjNkhjkQXvfFgK8vvJn99wdgRjjKGwSdN8p1zk5Mx4F2uJWjR2/NnfG9tDR2e3BX8zwM2NXrPL0r/crHw6+5r/Tdjfu0g73sx38V6INZT8yg5QwjLbVRHn9WG/GPcs6yq4eHf6SpfvsD4KBgKMGK3SVqT/dp99xufKd3d0blmTe6h8q547tP+kHVSo7Fq7U7Pr2g6pw5q/66E1+u6j3l06UPT2nOdNxBMOM8mXcm5wuqdnIsXq3l41tz8W9/ACLEGs4+AYd4Qo8GrTM7uTAP9kzPiGs2nJ0/0kqOFiSuVh5q7sh31srJue0NanLAPwsao53k4Kxe+KN9ZrPSs2vdCezyd3j0YIe74rgzGHHkodbMdFdszcf/5QPgAlO4Yg260vdJPbOLOrOjewQ9/YHI3YUd+12L5a9o6+19ckGviZ1PnQW5K+g7d61RLAdX5u30eGbQd9vpHXHo0INRPbldS8/dV75YvubE8jXX/V8+AL14NfZwnjrs1R2u9OXCji5tR9v5YYd7hpMdRz32Vh/VZjk7el6z+ixvlj4Whx+IQcyuYP7uzvTMC6quGq2au+vP9Mwaac/yM52RxlHOXTn/iCevrsaK+faa7fDLByANms7AgDP8T+TWC7u6X+5hdtlXddO3s6NniJeeHWvf7N758tDzYrPU2ED+LMzf6TGj8syu8Z/ue679DvqZ1SvPHa3u968PgIYqpCkxHxJ3m5rBfFgN7P2rmA69FWdV00tjxVFzfvvzQR/wZ1CH1OPvzEvPjrUb7HA7Rx/0/Ci2tzN0yOMnz69wb6mxYvX44t0d9OGzQY+Tj76Ynz3FT+Ku7t1+dwdXzuRejvr++gAg5aLTxELyOB3qcpVz98D0KuiZAzW/8nFB74qn5nLr/vrk9cYXd6QHB1KnFyR31dIxB/gjnTq71vH1Ab/WZr4zd+DKsbTMA3EgD4ljOy/5mQ0/dsRTg8zjZ78R/6mcOdHKbPFOHu8Io7rnZhbwR5w6v9bl9cGsF/9fikgCTWwuNHm5jnCT73HyT1j7gBkV0a45Pi6kvrJ4egIx6GGTZ+Uqcj9skLrY3SY+a/XSSF/80R7hsKmHL8enx7+K3AUtMKcj2vL4wE9+ZXHV8enzQVyhBqmlT/xKmGmPPkO+5/BG+c5bxZ5X1YhPe9WXevi4fHr8jn//DSCFeqHEQI0FPhANal7tVbBb0Gckz/baUawn6Nzk2dE53UHveVW8O2uXd3bPegeZIRfQ63dUa+pHoEsjCF8eEqvTTvwOa765QZ2ZHItXa0/5u7q7PHv99X8OammoF8rv0IAXiMFA4P/pyNlnNudXd3+Jr1gacKU3PfpB7E+BCrmzcCZ6MOvFmdVmeXullneJDiQfa/Yon/orrd3ADHsEYnngP4GqfVXvSOOvvwG4TDgaghPgRjxW7k9Gzr5rr95FfgxeJpjpuHe1WH6HfpBnKzJH7Qzq+Wtf8jV3xrcbvvPQ4n8C7GKn7MKX65DvnMQr22t5Lu4Dej1x5sUmX61+kIsuP/jrA5DgjO2HT3xG44e7vgEPtkNHcnz3ztZc/GorJ/n0qn0X2P077n3lfp21g05y/NxFzcWvFneEyx+Akdg7cw6eA/LfOfvVs5xnF3bZ5Xae3k+B3VbPc1V75xnssZp3VF/1puYudqFnl4uHX/FtPwAO4UDA/8H3vwHPEvpJ5IJee1dsfn7c/NHc5PHij3iflPvWH4BPusifXf78G/CjhtVJ1WHFqbWv9v8/AAAA//+qqmo6AAAABklEQVQDALLt0SwK2DYxAAAAAElFTkSuQmCC";

export type AnimationName = "idle" | "alert" | "tired" | "groom" | "itch" | "sleep" | "walkR" | "walkL";

export const ANIMATIONS: Record<AnimationName, Array<[number, number]>> = {
    idle: [[-3, -3]],
    alert: [[-7, -3]],
    tired: [[-3, -2]],
    groom: [[-5, 0], [-6, 0], [-7, 0]],
    itch: [[-5, -1], [-6, -2]],
    sleep: [[-2, 0], [-2, -1]],
    walkR: [[-3, 0], [-3, -1]],
    walkL: [[-4, -2], [-4, -3]]
};

export const SITTING: ReadonlySet<AnimationName> = new Set(["idle", "alert", "tired"] as AnimationName[]);

const PALETTE: Record<string, string> = {
    o: "#3a2230",
    r: "#ff4d6d",
    p: "#ff5fa6",
    y: "#ffd46b",
    w: "#ffe9f4",
    b: "#8ad1ff"
};

export const ACCESSORIES: Record<string, { label: string; grid: string[]; x: number; y: number; }> = {
    bow: {
        label: "Pink bow",
        x: 16, y: 5,
        grid: [
            "r.....r",
            "rr...rr",
            "rrrprrr",
            "rr...rr",
            "r.....r"
        ]
    },
    scarf: {
        label: "Cozy scarf",
        x: 11, y: 18,
        grid: [
            "bbbbbbbbb",
            ".bbbbbbb.",
            "....bb...",
            "....bb..."
        ]
    },
    hat: {
        label: "Party hat",
        x: 13, y: 1,
        grid: [
            "..ww..",
            "..yy..",
            ".yyyy.",
            ".yyyy.",
            "yyyyyy"
        ]
    },
    crown: {
        label: "Crown",
        x: 13, y: 4,
        grid: [
            "y.y.y.",
            "yyyyyy",
            "yyyyyy"
        ]
    }
};

export function gridToSvgUri(grid: string[]): string {
    const height = grid.length;
    const width = Math.max(...grid.map(r => r.length));
    let rects = "";
    for (let y = 0; y < height; y++) {
        const row = grid[y];
        let x = 0;
        while (x < row.length) {
            const ch = row[x];
            const color = PALETTE[ch];
            if (!color) { x++; continue; }
            let run = 1;
            while (x + run < row.length && row[x + run] === ch) run++;
            rects += `<rect x="${x}" y="${y}" width="${run}" height="1" fill="${color}"/>`;
            x += run;
        }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" shape-rendering="crispEdges">${rects}</svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const ACCESSORY_URIS: Record<string, string> = Object.fromEntries(
    Object.entries(ACCESSORIES).map(([name, a]) => [name, gridToSvgUri(a.grid)])
);
